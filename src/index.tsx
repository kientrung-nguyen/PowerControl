/*!
 * Copyright (C) 2022 Sefa Eyeoglu <contact@scrumplex.net> (https://scrumplex.net)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import {
  definePlugin,
  PanelSection,
  PanelSectionRow,
  SliderField,
  ServerAPI,
  ToggleField,
  staticClasses,
} from "decky-frontend-lib";
import { VFC, useState, useEffect } from "react";
import { FaSuperpowers } from "react-icons/fa";
import { loadSettingsFromLocalStorage, Settings, saveSettingsToLocalStorage } from "./settings";
import { RunningApps, Backend, DEFAULT_APP} from "./util";

var lifetimeHook: any = null;
var suspendEndHook: any = null;

// Appease TypeScript
declare var SteamClient: any;

let settings: Settings;

const Content: VFC<{runningApps: RunningApps, applyFn: (appId: string) => void, resetFn: () => void, backend:Backend}> = ({ runningApps, applyFn, resetFn, backend }) => {
  const [initialized, setInitialized] = useState<boolean>(false);

  const [currentEnabled, setCurrentEnabled] = useState<boolean>(true);
  const [currentAppOverride, setCurrentAppOverride] = useState<boolean>(false);
  const [currentAppOverridable, setCurrentAppOverridable] = useState<boolean>(false);
  const [currentTargetSmt, setCurrentTargetSmt] = useState<boolean>(true);
  const [currentTargetCpuBoost, setCurrentTargetCpuBoost] = useState<boolean>(true);
  const [currentTargetCpuNum, setCurrentTargetCpuNum] = useState<number>(backend.data.getCpuMaxNum());
  const [currentTargetTDPEnable, setCurrentTargetTDPEnable] = useState<boolean>(false);
  const [currentTargetTDP, setCurrentTargetTDP] = useState<number>(backend.data.getTDPMax());
  const [currentTargetGPUManual, setCurrentTargetGPUManual] = useState<boolean>(false);
  const [currentTargetGPUFreq, setCurrentTargetGPUFreq] = useState<number>(backend.data.getGPUFreqMax());
  const refresh = () => {
    // prevent updates while we are reloading
    setInitialized(false);

    setCurrentEnabled(settings.enabled)

    const activeApp = RunningApps.active();
    // does active app have a saved setting
    setCurrentAppOverride(settings.perApp[activeApp]?.hasSettings() || false);
    setCurrentAppOverridable(activeApp != DEFAULT_APP);

    // get configured saturation for current app (also Deck UI!)
    setCurrentTargetSmt(settings.appSmt(activeApp));
    setCurrentTargetCpuNum(settings.appCpuNum(activeApp));
    setCurrentTargetCpuBoost(settings.appCpuboost(activeApp));
    setCurrentTargetTDP(settings.appTDP(activeApp));
    setCurrentTargetTDPEnable(settings.appTDPEnable(activeApp));
    setCurrentTargetGPUManual(settings.appGPUManual(activeApp));
    setCurrentTargetGPUFreq(settings.appGPUFreq(activeApp));
    setInitialized(true);
  }

  useEffect(() => {
    if (!initialized || !currentEnabled)
      return;

    let activeApp = RunningApps.active();
    if (currentAppOverride && currentAppOverridable) {
      console.log(`设置app(${activeApp})配置状态`);
    } else {
      console.log(`设置默认配置状态`);
      activeApp = DEFAULT_APP;
    }
    settings.ensureApp(activeApp).smt = currentTargetSmt;
    settings.ensureApp(activeApp).cpuNum = currentTargetCpuNum;
    settings.ensureApp(activeApp).cpuboost = currentTargetCpuBoost;
    settings.ensureApp(activeApp).tdp = currentTargetTDP;
    settings.ensureApp(activeApp).tdpEnable = currentTargetTDPEnable;
    settings.ensureApp(activeApp).gpuManual = currentTargetGPUManual;
    settings.ensureApp(activeApp).gpuFreq = currentTargetGPUFreq;
    applyFn(RunningApps.active());

    saveSettingsToLocalStorage(settings);
  }, [currentTargetSmt,currentTargetCpuNum, currentTargetCpuBoost, currentTargetTDP, currentTargetTDPEnable, currentTargetGPUManual, currentTargetGPUFreq, currentEnabled, initialized]);

  useEffect(() => {
    if (!initialized || !currentEnabled)
      return;

    const activeApp = RunningApps.active();
    if (activeApp == DEFAULT_APP)
      return;

    console.log(`使用 ${activeApp} 配置文件来覆盖`);

    if (!currentAppOverride) {
      settings.ensureApp(activeApp).smt = undefined;
      settings.ensureApp(activeApp).cpuNum = undefined;
      settings.ensureApp(activeApp).cpuboost = undefined;
      settings.ensureApp(activeApp).tdp = undefined;
      settings.ensureApp(activeApp).tdpEnable = undefined;
      settings.ensureApp(activeApp).gpuManual = undefined;
      settings.ensureApp(activeApp).gpuFreq = undefined;
      setCurrentTargetSmt(settings.appSmt(DEFAULT_APP));
      setCurrentTargetCpuNum(settings.appCpuNum(DEFAULT_APP));
      setCurrentTargetCpuBoost(settings.appCpuboost(DEFAULT_APP));
      setCurrentTargetTDP(settings.appTDP(DEFAULT_APP));
      setCurrentTargetTDPEnable(settings.appTDPEnable(DEFAULT_APP));
      setCurrentTargetGPUManual(settings.appGPUManual(DEFAULT_APP));
      setCurrentTargetGPUFreq(settings.appGPUFreq(DEFAULT_APP));
    }
    saveSettingsToLocalStorage(settings);
  }, [currentAppOverride, currentEnabled, initialized]);

  useEffect(() => {
    if (!initialized)
      return;

    if (!currentEnabled)
      resetFn();

    settings.enabled = currentEnabled;
    saveSettingsToLocalStorage(settings);
  }, [currentEnabled, initialized]);

  useEffect(() => {
    refresh();
    runningApps.listenActiveChange(() => refresh());
  }, []);

  return (
    <div>
      <PanelSection title="设置">
        <PanelSectionRow>
          <ToggleField
            label="启用插件设置"
            checked={currentEnabled}
            onChange={(enabled) => {
              setCurrentEnabled(enabled);
            }}
          />
        </PanelSectionRow>
           {currentEnabled&&
            <PanelSectionRow>
            <ToggleField
              label={currentAppOverridable ?`使用『${RunningApps.active_app()?.display_name}』配置文件`:"使用配置文件"}
              description={
                  <div style={{ display: "flex", justifyContent: "left" }}>
                  <img src={ RunningApps.active_app()?.icon_data? "data:image/" +RunningApps.active_app()?.icon_data_format +";base64," +RunningApps.active_app()?.icon_data: "/assets/" + RunningApps.active_app()?.appid + "_icon.jpg?v=" + RunningApps.active_app()?.icon_hash} width={18} height={18}
                        style={{ display: currentAppOverride&&currentAppOverridable? "block":"none"}}
                  />
                  {" 正在使用" + (currentAppOverride && currentAppOverridable ? `『${RunningApps.active_app()?.display_name}』` : "默认") + "配置文件"}
                  </div>
              }
              checked={currentAppOverride && currentAppOverridable}
              disabled={!currentAppOverridable}
              onChange={(override) => {
                setCurrentAppOverride(override);
              }}
            />
          </PanelSectionRow>}
      </PanelSection>
      {currentEnabled &&
        <PanelSection title="CPU">
           <PanelSectionRow>
            <ToggleField
              label="睿 频"
              description={"提升最大cpu频率"}
              checked={currentTargetCpuBoost}
              onChange={(value) => {
                setCurrentTargetCpuBoost(value);
              }}
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <ToggleField
              label="SMT"
              description={"启用奇数编号的cpu"}
              checked={currentTargetSmt}
              onChange={(smt) => {
                setCurrentTargetSmt(smt);
              }}
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <SliderField
              label="核 心 数"
              description={`设置启用的物理核心数量`}
              value={currentTargetCpuNum}
              step={1}
              max={backend.data.getCpuMaxNum()}
              min={1}
              disabled={!backend.data.HasCpuMaxNum()}
              showValue={true}
              onChange={(value: number) => {
                setCurrentTargetCpuNum(value);
              }}
            />
          </PanelSectionRow>
          <PanelSectionRow>
            <ToggleField
              label="热设计功耗（TDP）限制"
              description={backend.data.HasRyzenadj()?"限制处理器功耗以降低总功耗":"未检测到ryzenAdj"}
              checked={currentTargetTDPEnable}
              disabled={!backend.data.HasRyzenadj()}
              onChange={(value) => {
                setCurrentTargetTDPEnable(value);
              }}
            />
          </PanelSectionRow>
          {currentTargetTDPEnable&&<PanelSectionRow>
            <SliderField
              label="瓦特"
              value={currentTargetTDP}
              step={1}
              max={backend.data.getTDPMax()}
              min={3}
              disabled={!backend.data.HasTDPMax()}
              showValue={true}
              onChange={(value: number) => {
                setCurrentTargetTDP(value);
              }}
            />
          </PanelSectionRow>}
        </PanelSection>
      }
      {currentEnabled&&<PanelSection title="GPU">
        <PanelSectionRow>
          <ToggleField
            label="GPU 频率手动控制"
            description={"将GPU设置为固定频率"}
            checked={currentTargetGPUManual}
            disabled={!backend.data.HasGPUFreqMax()}
            onChange={(value) => {
              setCurrentTargetGPUManual(value);
            }}
          />
        </PanelSectionRow>
        {currentTargetGPUManual&&<PanelSectionRow>
          <SliderField
            label="GPU 频率"
            value={currentTargetGPUFreq}
            step={50}
            max={backend.data.getGPUFreqMax()}
            min={200}
            disabled={!backend.data.HasGPUFreqMax()}
            showValue={true}
            onChange={(value: number) => {
              setCurrentTargetGPUFreq(value);
            }}
          />
        </PanelSectionRow>}
      </PanelSection>
      }
    </div>
  );
};

export default definePlugin((serverAPI: ServerAPI) => {
  // load settings
  settings = loadSettingsFromLocalStorage();

  const backend = new Backend(serverAPI);
  const runningApps = new RunningApps();

  const applySettings = (appId: string) => {
    const smt = settings.appSmt(appId);
    const cpuNum = settings.appCpuNum(appId);
    const cpuBoost = settings.appCpuboost(appId);
    const tdp = settings.appTDP(appId);
    const tdpEnable = settings.appTDPEnable(appId);
    const gpuManual = settings.appGPUManual(appId);
    const gpuFreq = settings.appGPUFreq(appId);
    backend.applySmt(smt);
    backend.applyCpuNum(cpuNum);
    backend.applyCpuBoost(cpuBoost);
    if (tdpEnable){
      backend.applyTDP(tdp);
    }
    else{
      backend.applyTDP(backend.data.getTDPMax());
    }
    if(gpuManual){
      backend.applyGPUFreq(gpuFreq);
    }else{
      backend.applyGPUFreq(0);
    }
  };

  const resetSettings = () => {
    console.log("重置所有设置");
    backend.applySmt(true);
    backend.applyCpuNum(backend.data.getCpuMaxNum());
    backend.applyCpuBoost(true);
    backend.applyTDP(backend.data.getTDPMax());
    backend.applyGPUFreq(0);
  };

  runningApps.register();
  lifetimeHook = SteamClient.GameSessions.RegisterForAppLifetimeNotifications((update: {
    unAppID: any; bRunning: any; 
}) => {
    if (update.bRunning) {
        console.log(`unAppID=${update.unAppID} 游戏状态更新`)
        if (settings.enabled){
          applySettings(RunningApps.active());
        }
        else{
          resetSettings();
        }
    } else {
        console.log("unAppID=" + update.unAppID.toString() + "结束游戏"); 
        if (settings.enabled){
          applySettings(DEFAULT_APP);
        }else{
          resetSettings();
        }
    }
});
  suspendEndHook=SteamClient.System.RegisterForOnResumeFromSuspend(async () => {
    console.log("休眠结束，重新应用设置")
    if (settings.enabled){
      applySettings(RunningApps.active());
    }else{
      resetSettings();
    }
});
  

  // apply initially
  if (settings.enabled) {
    applySettings(RunningApps.active());
  }

  return {
    title: <div className={staticClasses.Title}>PowerControl</div>,
    content: <Content runningApps={runningApps} applyFn={applySettings} resetFn={resetSettings} backend={backend}/>,
    icon: <FaSuperpowers />,
    onDismount() {
      lifetimeHook!.unregister();
      suspendEndHook!.unregister();
      runningApps.unregister();
      resetSettings();
    }
  };
});
