import { z } from "zod";
import { permissions, roles } from "./roles";
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9._-]+$/);
export const passwordSchema = z.string().min(12, "Use at least 12 characters").max(128);
export const assignmentSchema = z.object({
  organizationId: z.uuid(),
  centreId: z.uuid(),
  role: z.enum(roles),
});
export const employeeSchema = z.object({
  name: z.string().trim().min(2).max(100),
  username: usernameSchema,
  email: z.email().toLowerCase(),
  mobile: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/),
  department: z.string().trim().min(1).max(100),
  active: z.boolean(),
  assignments: z.array(assignmentSchema).min(1).max(20),
});
export const createEmployeeSchema = employeeSchema.extend({ password: passwordSchema });
export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1).max(128), newPassword: passwordSchema })
  .refine((v) => v.currentPassword !== v.newPassword, "Choose a different password");
export const permissionUpdateSchema = z.object({
  organizationId: z.uuid(),
  role: z.enum(roles).exclude(["Super Admin", "Admin"]),
  permissions: z.array(z.enum(permissions)).max(permissions.length),
});
export type EmployeeInput = z.infer<typeof employeeSchema>;
