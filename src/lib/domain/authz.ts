import type { Role } from "./types";

const rank: Record<Role, number> = { member: 0, mentor: 1, admin: 2, owner: 3 };
export const atLeast = (role: Role, min: Role) => rank[role] >= rank[min];

export const isStaff = (role: Role) => atLeast(role, "mentor");
export const canManageContent = (role: Role) => atLeast(role, "admin");
export const canReviewSubmissions = (role: Role) => atLeast(role, "mentor");
export const canManageUsers = (role: Role) => atLeast(role, "owner");

/** Staff see every program; members need an active enrollment. */
export const canAccessProgram = (role: Role, hasActiveEnrollment: boolean) => isStaff(role) || hasActiveEnrollment;

/** The question's author or staff may mark an accepted answer. */
export const canAcceptAnswer = (role: Role, userId: string, threadAuthorId: string) =>
  userId === threadAuthorId || isStaff(role);

export const canEditPost = (userId: string, authorId: string) => userId === authorId;
export const canDeletePost = (role: Role, userId: string, authorId: string) =>
  userId === authorId || atLeast(role, "admin");
