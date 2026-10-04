import { ObjectID } from 'mongodb';
import type { ReleaseDBScheme } from '@hawk.so/types';
import { groupReleasesByProject } from '../../src/utils/group-releases-by-project';

/**
 * Create a release record with a predictable id.
 *
 * @param projectId - project identifier
 * @param release - release name
 * @param createdAtSeconds - release creation time
 */
function createRelease(projectId: string, release: string, createdAtSeconds: number): ReleaseDBScheme {
  return {
    _id: ObjectID.createFromTime(createdAtSeconds),
    projectId,
    release,
    commits: [],
  };
}

describe('groupReleasesByProject', () => {
  test('should group releases by project and preserve their input order', () => {
    // Arrange
    const releases = [
      createRelease('project-a', 'a', 1),
      createRelease('project-b', 'x', 2),
      createRelease('project-a', 'b', 3),
      createRelease('project-b', 'y', 4),
      createRelease('project-a', 'c', 5),
    ];

    // Act
    const result = groupReleasesByProject(releases);

    // Assert
    expect(Array.from(result.entries()).map(([projectId, projectReleases]) => {
      return [projectId, projectReleases.map(release => release.release)];
    })).toEqual([
      ['project-a', ['a', 'b', 'c'] ],
      ['project-b', ['x', 'y'] ],
    ]);
  });

  test('should return an empty map for an empty release list', () => {
    // Arrange
    const releases: ReleaseDBScheme[] = [];

    // Act
    const result = groupReleasesByProject(releases);

    // Assert
    expect(Array.from(result.entries())).toEqual([]);
  });
});
