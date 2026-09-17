import { ReleaseRecord } from '../types';

/**
 * Group chronologically ordered releases by project.
 *
 * @param releases - releases ordered from oldest to newest
 */
export function groupReleasesByProject(releases: ReleaseRecord[]): Map<string, ReleaseRecord[]> {
  const releasesByProject = new Map<string, ReleaseRecord[]>();

  for (const release of releases) {
    const projectReleases = releasesByProject.get(release.projectId) || [];

    projectReleases.push(release);
    releasesByProject.set(release.projectId, projectReleases);
  }

  return releasesByProject;
}
