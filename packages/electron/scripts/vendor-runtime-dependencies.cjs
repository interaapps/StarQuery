const fs = require('node:fs');
const path = require('node:path');
const { builtinModules } = require('node:module');

const electronDir = path.resolve(__dirname, '..');
const workspaceDir = path.resolve(electronDir, '..', '..');
const electronPackageJsonPath = path.join(electronDir, 'package.json');
const builtinModuleNames = new Set(
  builtinModules.flatMap((name) => [name, name.startsWith('node:') ? name.slice(5) : `node:${name}`]),
);
const searchNodeModulesRoots = [
  path.join(electronDir, 'node_modules'),
  path.join(workspaceDir, 'node_modules'),
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function ensureDirectory(filePath) {
  fs.mkdirSync(filePath, { recursive: true });
}

function findPackageJsonInNodeModules(packageName) {
  const packageSegments = packageName.split('/');

  for (const rootDir of searchNodeModulesRoots) {
    const packageJsonPath = path.join(rootDir, ...packageSegments, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      return packageJsonPath;
    }
  }

  return null;
}

function resolveInstalledPackageJson(packageName) {
  const directNodeModulesPackageJson = findPackageJsonInNodeModules(packageName);
  if (directNodeModulesPackageJson) {
    return directNodeModulesPackageJson;
  }

  if (packageName.startsWith('node:')) {
    return null;
  }

  let packageEntrypointPath;
  try {
    packageEntrypointPath = require.resolve(packageName, {
      paths: [electronDir, workspaceDir],
    });
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'MODULE_NOT_FOUND') {
      if (builtinModuleNames.has(packageName)) {
        return null;
      }

      return null;
    }

    throw error;
  }

  let currentDir = path.dirname(packageEntrypointPath);
  while (currentDir !== path.dirname(currentDir)) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = readJson(packageJsonPath);
      if (packageJson.name === packageName) {
        return packageJsonPath;
      }
    }

    currentDir = path.dirname(currentDir);
  }

  if (builtinModuleNames.has(packageName)) {
    return null;
  }

  throw new Error(`Could not locate package.json for ${packageName}`);
}

function collectDependencyNames(packageJson) {
  return new Set([
    ...Object.keys(packageJson.dependencies || {}),
    ...Object.keys(packageJson.optionalDependencies || {}),
  ]);
}

function copyPackageTree(sourceDir, targetDir) {
  fs.cpSync(sourceDir, targetDir, {
    recursive: true,
    dereference: true,
    force: true,
  });
}

function pruneVendoredPackage(packageName, targetPackageDir, targetPlatform, targetArch) {
  if (packageName !== 'oracledb') {
    return;
  }

  const releaseDir = path.join(targetPackageDir, 'build', 'Release');
  if (!fs.existsSync(releaseDir)) {
    return;
  }

  const expectedBinarySuffix = `-${targetPlatform}-${targetArch}.node`;
  const releaseEntries = fs.readdirSync(releaseDir);

  for (const entryName of releaseEntries) {
    if (!entryName.startsWith('oracledb-')) {
      continue;
    }

    const isNativeBinary = entryName.endsWith('.node');
    const isBuildInfo = entryName.endsWith('.node-buildinfo.txt');
    if (!isNativeBinary && !isBuildInfo) {
      continue;
    }

    const matchesTarget = entryName.includes(expectedBinarySuffix);
    if (!matchesTarget) {
      fs.rmSync(path.join(releaseDir, entryName), { force: true });
    }
  }
}

async function vendorRuntimeDependencies(buildPath, targetPlatform, targetArch) {
  const electronPackageJson = readJson(electronPackageJsonPath);
  const pending = [...collectDependencyNames(electronPackageJson)];
  const visited = new Set();
  const targetNodeModulesDir = path.join(buildPath, 'node_modules');

  ensureDirectory(targetNodeModulesDir);

  while (pending.length > 0) {
    const packageName = pending.shift();
    if (!packageName || visited.has(packageName)) {
      continue;
    }

    visited.add(packageName);

    const installedPackageJsonPath = resolveInstalledPackageJson(packageName);
    if (!installedPackageJsonPath) {
      continue;
    }
    const installedPackageDir = path.dirname(installedPackageJsonPath);
    const targetPackageDir = path.join(targetNodeModulesDir, ...packageName.split('/'));

    ensureDirectory(path.dirname(targetPackageDir));
    copyPackageTree(installedPackageDir, targetPackageDir);
    pruneVendoredPackage(packageName, targetPackageDir, targetPlatform, targetArch);

    const installedPackageJson = readJson(installedPackageJsonPath);
    for (const dependencyName of collectDependencyNames(installedPackageJson)) {
      if (!visited.has(dependencyName)) {
        pending.push(dependencyName);
      }
    }
  }
}

module.exports = async function afterCopy(buildPath, electronVersion, platform, arch, callback) {
  try {
    await vendorRuntimeDependencies(buildPath, platform, arch);
    callback();
  } catch (error) {
    callback(error);
  }
};
