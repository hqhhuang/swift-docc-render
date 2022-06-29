/* eslint-disable no-extra-boolean-cast */
/**
 * This source file is part of the Swift.org open source project
 *
 * Copyright (c) 2021 Apple Inc. and the Swift project authors
 * Licensed under Apache License v2.0 with Runtime Library Exception
 *
 * See https://swift.org/LICENSE.txt for license information
 * See https://swift.org/CONTRIBUTORS.txt for Swift project authors
*/
/* eslint-disable no-plusplus */
import { apply } from './json-patch';
import { clone } from './data';

function getDiffIndex(displayName, data) {
  const index = data.versions.findIndex(item => item.version.displayName === displayName);
  return index;
}

function dataHasVersion(data) {
  if (!data) return false;
  if (!('metadata' in data)) return false;
  if (!('version' in data.metadata)) return false;
  if (!('versions' in data)) return false;
  return true;
}

function initializeVersionList(data) {
  if (dataHasVersion(data)) {
    const versions = data.versions.map(x => x.version.displayName);
    versions.unshift(data.metadata.version.displayName);
    return versions;
  }
  return null;
}

function patchToVersion(displayName, data) {
  if (!data) return null;
  if (!displayName) return data;
  if (!dataHasVersion(data)) return data;
  const patchIndex = getDiffIndex(displayName, data);
  if (patchIndex === -1) {
    return data;
  }

  let patchJSON = clone(data);
  for (let i = 0; i <= patchIndex; i++) {
    patchJSON = apply(patchJSON, data.versions[i].patch);
  }
  return patchJSON;
}

// function createDiff(newData, oldData){

// }
// eslint-disable-next-line import/prefer-default-export
export { dataHasVersion, patchToVersion, initializeVersionList };
