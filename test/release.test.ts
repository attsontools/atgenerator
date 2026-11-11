import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import {
  assertVersionAlignment,
  expectedReleaseAssets,
  verifyReleaseAssets
} from '../scripts/verify-release.mjs';

const version = '0.1.0-alpha.1';

describe('production release contract', () => {
  it('runs validation on pull requests without entering the release build matrix', async () => {
    const workflow = await readFile(
      path.resolve(import.meta.dirname, '..', '.github', 'workflows', 'release.yml'),
      'utf8'
    );

    assert.match(workflow, /pull_request:/);
    assert.match(
      workflow,
      /build:\n\s+if: github\.event_name != 'pull_request'\n\s+needs: test/
    );
  });

  it('uses Generator publisher secrets and asset names in the build matrix', async () => {
    const workflow = await readFile(
      path.resolve(import.meta.dirname, '..', '.github', 'workflows', 'release.yml'),
      'utf8'
    );
    assert.match(workflow, /ATGENERATOR_PUBLISHER_KEY_ID/);
    assert.match(workflow, /AT\.Generator_\$\{VERSION\}/);
    assert.match(workflow, /name: generator-\$\{\{ matrix\.label \}\}/);
    assert.doesNotMatch(workflow, /ATTEXT_|AT\.Text_|name: text-/);
  });

  it('runs tag version verification with Bash on every matrix platform', async () => {
    const workflow = await readFile(
      path.resolve(import.meta.dirname, '..', '.github', 'workflows', 'release.yml'),
      'utf8'
    );

    assert.match(
      workflow,
      /- name: Verify release version alignment\n\s+if: [^\n]+\n\s+shell: bash\n\s+run: node scripts\/verify-release\.mjs versions "\$\{GITHUB_REF_NAME\}"/
    );
  });

  it('requires the tag, package, Tauri, and Cargo versions to match', () => {
    assert.doesNotThrow(() => assertVersionAlignment({
      tagName: `v${version}`,
      packageVersion: version,
      tauriVersion: version,
      cargoVersion: version
    }));
    assert.throws(
      () => assertVersionAlignment({
        tagName: `v${version}`,
        packageVersion: version,
        tauriVersion: '0.1.0-alpha.0',
        cargoVersion: version
      }),
      /versions must all match tag/
    );
  });

  it('requires the exact five standalone and five plugin assets', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'atgenerator-release-assets-'));
    const expected = [
      `AT.Generator_${version}_linux_aarch64.atpkg`,
      `AT.Generator_${version}_linux_aarch64.deb`,
      `AT.Generator_${version}_linux_x86_64.atpkg`,
      `AT.Generator_${version}_linux_x86_64.deb`,
      `AT.Generator_${version}_macos_aarch64.atpkg`,
      `AT.Generator_${version}_macos_aarch64.dmg`,
      `AT.Generator_${version}_macos_x86_64.atpkg`,
      `AT.Generator_${version}_macos_x86_64.dmg`,
      `AT.Generator_${version}_windows_x86_64.atpkg`,
      `AT.Generator_${version}_windows_x86_64.exe`
    ];
    assert.deepEqual(expectedReleaseAssets(version), expected);
    try {
      await Promise.all(expected.map((name) => writeFile(path.join(directory, name), 'asset')));
      await assert.doesNotReject(() => verifyReleaseAssets(directory, version));

      await rm(path.join(directory, expected[0]));
      await assert.rejects(
        () => verifyReleaseAssets(directory, version),
        /exact release asset set/
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
