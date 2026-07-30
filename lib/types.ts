export type UserRole = "super_admin" | "area_head" | "store_manager" | "supervisor" | "employee";

export type TrainingStatus = "not_started" | "in_progress" | "completed";

export type ComplianceStatus = "pending" | "submitted" | "approved" | "rejected" | "overdue";

export type FileKind = "pdf" | "pptx" | "docx" | "xlsx" | "image" | "video" | "other";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  area_id: string | null;
  branch_id: string | null;
  department_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

export interface Area {
  id: string;
  name: string;
}

export interface Branch {
  id: string;
  area_id: string;
  name: string;
  address: string | null;
}

export interface TrainingModule {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  department_id: string | null;
  branch_id: string | null;
  area_id: string | null;
  file_kind: FileKind;
  file_path: string;
  thumbnail_path: string | null;
  version: string;
  author_id: string | null;
  estimated_duration_minutes: number | null;
  expiration_date: string | null;
  is_video: boolean;
  video_duration_seconds: number | null;
  created_at: string;
}

export interface TrainingProgress {
  id: string;
  training_id: string;
  user_id: string;
  status: TrainingStatus;
  progress_percent: number;
  last_position_seconds: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface ComplianceSubmission {
  id: string;
  category_id: string;
  branch_id: string;
  submitted_by: string | null;
  status: ComplianceStatus;
  due_date: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  review_comments: string | null;
}

export interface DocumentRecord {
  id: string;
  title: string;
  doc_type: "sop" | "policy" | "manual" | "guideline" | "form" | "memo";
  category: string | null;
  file_path: string;
  version: string;
  requires_acknowledgment: boolean;
}

// Role permission matrix — single source of truth for what each role can do.
// Used by components and server actions to gate UI and writes.
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  super_admin: ["*"],
  area_head: [
    "training.upload", "training.view", "compliance.review", "compliance.view",
    "sop.upload", "reports.view", "users.manage_area",
  ],
  store_manager: [
    "training.upload", "training.view", "compliance.submit", "compliance.review",
    "sop.view", "reports.view_branch",
  ],
  supervisor: ["training.view", "compliance.submit", "sop.view", "reports.view_branch"],
  employee: ["training.view", "sop.view"],
};

export function hasPermission(role: UserRole, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role] ?? [];
  return perms.includes("*") || perms.includes(permission);
}
