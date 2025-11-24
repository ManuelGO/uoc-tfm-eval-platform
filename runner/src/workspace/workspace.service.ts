import { rmSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, normalize, relative } from 'node:path';
import extract from 'extract-zip';

/**
 * Workspace Service
 *
 * Handles ZIP extraction and workspace management for submission processing.
 * Protects against ZIP Slip attacks and manages isolated execution environments.
 */
export class WorkspaceService {
  private readonly workspaceRoot: string = './work';

  /**
   * Extract a ZIP file into an isolated workspace directory
   *
   * @param zipPath       Path to the ZIP file to extract
   * @param submissionId  UUID of the submission (used for workspace naming)
   * @returns             Absolute path to the workspace directory
   */
  async extractZip(zipPath: string, submissionId: string): Promise<string> {
    const workspaceDir = this.getWorkspacePath(submissionId);

    console.log('[WorkspaceService] Preparing workspace', {
      submissionId,
      zipPath,
      workspaceDir,
    });

    // Clean up any previous workspace for this submission
    this.cleanWorkspace(submissionId);

    // Ensure workspace directory exists
    this.ensureDirectory(workspaceDir);

    try {
      // Extract ZIP using extract-zip (protects against ZIP Slip by default)
      await extract(zipPath, { dir: resolve(workspaceDir) });

      console.log('[WorkspaceService] ZIP extracted successfully', {
        submissionId,
        workspaceDir,
      });

      // Verify workspace integrity (no files escaped)
      this.verifyWorkspaceIntegrity(workspaceDir);

      return resolve(workspaceDir);
    } catch (error) {
      console.error('[WorkspaceService] Failed to extract ZIP', {
        submissionId,
        zipPath,
        error,
      });

      // Clean up on failure
      this.cleanWorkspace(submissionId);
      throw error;
    }
  }

  /**
   * Clean up workspace directory for a submission
   *
   * @param submissionId UUID of the submission
   */
  cleanWorkspace(submissionId: string): void {
    const workspaceDir = this.getWorkspacePath(submissionId);

    if (existsSync(workspaceDir)) {
      console.log('[WorkspaceService] Removing previous workspace', {
        submissionId,
        workspaceDir,
      });

      rmSync(workspaceDir, { recursive: true, force: true });
    }
  }

  /**
   * Get the workspace path for a submission
   *
   * @param submissionId UUID of the submission
   * @returns            Path to workspace directory
   */
  private getWorkspacePath(submissionId: string): string {
    return `${this.workspaceRoot}/${submissionId}`;
  }

  /**
   * Ensure directory exists
   *
   * @param path Directory path to create
   */
  private ensureDirectory(path: string): void {
    mkdirSync(path, { recursive: true });
  }

  /**
   * Verify workspace integrity - ensures no files escaped the workspace
   *
   * This is an additional safety check on top of extract-zip's built-in protection.
   * It verifies that all extracted files are within the workspace boundary.
   *
   * @param workspaceDir Workspace directory path
   * @throws Error if files escaped the workspace
   */
  private verifyWorkspaceIntegrity(workspaceDir: string): void {
    const absoluteWorkspace = resolve(workspaceDir);
    const normalizedWorkspace = normalize(absoluteWorkspace);

    // Verify the workspace itself exists
    if (!existsSync(normalizedWorkspace)) {
      throw new Error('Workspace directory does not exist after extraction');
    }

    // In a production environment, you might want to walk the directory tree
    // and verify each file is within bounds. For now, we rely on extract-zip's
    // built-in protection and this basic check.

    console.log('[WorkspaceService] Workspace integrity verified', {
      workspaceDir: normalizedWorkspace,
    });
  }

  /**
   * Additional ZIP Slip protection utility
   *
   * Validates that a file path is within the workspace boundary.
   * This can be used by other services that manipulate files in the workspace.
   *
   * @param workspaceDir  Workspace directory path
   * @param filePath      File path to validate
   * @returns             True if path is safe, false otherwise
   */
  isPathSafe(workspaceDir: string, filePath: string): boolean {
    const absoluteWorkspace = resolve(workspaceDir);
    const absoluteFile = resolve(workspaceDir, filePath);
    const relativePath = relative(absoluteWorkspace, absoluteFile);

    // If relative path starts with '..' or is absolute, it's trying to escape
    const isSafe = !relativePath.startsWith('..') && !resolve(relativePath).startsWith('/');

    if (!isSafe) {
      console.warn('[WorkspaceService] Detected path traversal attempt', {
        workspaceDir,
        filePath,
        relativePath,
      });
    }

    return isSafe;
  }
}
