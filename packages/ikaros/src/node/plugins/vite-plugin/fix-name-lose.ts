import type { Plugin, ResolvedConfig } from "vite";

export const fixNameLost = () => {
  let command = "";
  return <Plugin>{
    name: "@ikaros/fix-name-lose",
    configResolved(resolvedConfig: ResolvedConfig) {
      command = resolvedConfig.command;
    },
    buildStart: () => {
      if (command.includes("serve")) {
        globalThis.__name = (target: string, value: Record<string, any>) =>
          Object.defineProperty(target, "name", { value, configurable: true });
      }
    },
  };
};
