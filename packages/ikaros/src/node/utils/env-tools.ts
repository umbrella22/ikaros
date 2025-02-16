import fse from "fs-extra";
import { join } from "path";
import { config } from "dotenv";

import { warningLog } from "./logger";

const getEnvPath = (mode?: string) => {
  if (!mode) {
    return join(rootDir, "env", ".env");
  }
  return join(rootDir, "env", `.env.${mode}`);
};

const checkEnv = async (mode?: string) => {
  const hasEnvFolder = await fse.pathExists(join(rootDir, "env"));
  if (!hasEnvFolder) {
    warningLog("env folder not found");
    return false;
  }
  if (mode) {
    const hasEnv = await fse.pathExists(getEnvPath(mode));
    if (!hasEnv) {
      warningLog(`.env.${mode} file not found`);
      return false;
    }
  } else {
    const hasEnv = await fse.pathExists(getEnvPath());
    if (!hasEnv) {
      warningLog(".env file not found");
      return false;
    }
    return true;
  }
  return true;
};

export const rootDir = process.cwd();

export const getEnv = async (mode?: string) => {
  const hasEnv = await checkEnv(mode);
  if (!hasEnv) {
    return {};
  }
  if (!mode) {
    return config({ path: getEnvPath() }).parsed ?? {};
  }
  return config({ path: getEnvPath(mode) }).parsed ?? {};
};
