import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema";
import { roles } from "../auth/roles";
export * from "./auth-schema";

export const employeeRole = pgEnum("employee_role", roles);
const time = (name: string) => timestamp(name, { withTimezone: true });
const identity = () => ({
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: time("created_at").defaultNow().notNull(),
  updatedAt: time("updated_at").defaultNow().notNull(),
});
export const organizations = pgTable("organizations", {
  ...identity(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  product: text("product").notNull(),
});
const scope = () => ({
  ...identity(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "restrict" }),
});
export const centres = pgTable(
  "centres",
  { ...scope(), name: text("name").notNull(), active: boolean("active").notNull().default(true) },
  (t) => [unique().on(t.id, t.organizationId), unique().on(t.organizationId, t.name)],
);
export const employeeProfiles = pgTable("employee_profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  employeeCode: text("employee_code").notNull().unique(),
  mobile: text("mobile").notNull(),
  department: text("department").notNull(),
  active: boolean("active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  lastLoginAt: time("last_login_at"),
  createdAt: time("created_at").defaultNow().notNull(),
});
export const employeeRoleAssignments = pgTable(
  "employee_role_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => employeeProfiles.userId, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    centreId: uuid("centre_id").notNull(),
    role: employeeRole("role").notNull(),
  },
  (t) => [
    unique().on(t.userId, t.organizationId, t.centreId, t.role),
    foreignKey({
      columns: [t.centreId, t.organizationId],
      foreignColumns: [centres.id, centres.organizationId],
    }),
    index().on(t.userId, t.organizationId),
  ],
);
export const rolePermissions = pgTable(
  "role_permissions",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    role: employeeRole("role").notNull(),
    permission: text("permission").notNull(),
  },
  (t) => [primaryKey({ columns: [t.organizationId, t.role, t.permission] })],
);
export const customers = pgTable(
  "customers",
  {
    ...scope(),
    name: text("name").notNull(),
    mobile: text("mobile"),
    email: text("email"),
    centreId: uuid("centre_id"),
    assignedTo: text("assigned_to").references(() => user.id),
  },
  (t) => [
    unique().on(t.id, t.organizationId),
    foreignKey({
      columns: [t.centreId, t.organizationId],
      foreignColumns: [centres.id, centres.organizationId],
    }),
  ],
);
export const projects = pgTable(
  "projects",
  {
    ...scope(),
    customerId: uuid("customer_id").notNull(),
    name: text("name").notNull(),
    siteAddress: text("site_address"),
    centreId: uuid("centre_id"),
    assignedTo: text("assigned_to").references(() => user.id),
  },
  (t) => [
    unique().on(t.id, t.organizationId),
    foreignKey({
      columns: [t.centreId, t.organizationId],
      foreignColumns: [centres.id, centres.organizationId],
    }),
    foreignKey({
      columns: [t.customerId, t.organizationId],
      foreignColumns: [customers.id, customers.organizationId],
    }),
  ],
);
export const leads = pgTable(
  "leads",
  {
    ...scope(),
    customerId: uuid("customer_id").notNull(),
    projectId: uuid("project_id"),
    centreId: uuid("centre_id").notNull(),
    assignedTo: text("assigned_to").references(() => user.id),
    stage: integer("stage").notNull().default(1),
    outcome: text("outcome"),
    clientName: text("client_name"),
    mobile: text("mobile"),
    bookingMonth: integer("booking_month"),
    financialYear: text("financial_year"),
    brand: text("brand"),
    cseId: text("cse_id").references(() => user.id),
    siteAddress: text("site_address"),
    territory: text("territory"),
    soe: text("soe"),
    customerType: text("customer_type"),
    buildingType: text("building_type"),
    orderType: text("order_type"),
    finalisedValue: numeric("finalised_value", { precision: 14, scale: 2 }),
    orderQty: numeric("order_qty", { precision: 12, scale: 3 }),
    pleatedMeshQty: numeric("pleated_mesh_qty", { precision: 12, scale: 3 }),
    material: text("material"),
    discountOffered: text("discount_offered"),
    source: text("source"),
    priority: text("priority").notNull().default("normal"),
    expectedValue: numeric("expected_value", { precision: 14, scale: 2 }),
    nextFollowUp: time("next_follow_up"),
    nextAction: text("next_action"),
    remarks: text("remarks"),
    lossReason: text("loss_reason"),
    closedAt: time("closed_at"),
    archivedAt: time("archived_at"),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique().on(t.id, t.organizationId),
    check("lead_stage_range", sql`${t.stage} between 1 and 7`),
    check(
      "lead_outcome_valid",
      sql`${t.outcome} is null or (${t.stage} = 7 and ${t.outcome} in ('won', 'lost'))`,
    ),
    foreignKey({
      columns: [t.customerId, t.organizationId],
      foreignColumns: [customers.id, customers.organizationId],
    }),
    foreignKey({
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }),
    foreignKey({
      columns: [t.centreId, t.organizationId],
      foreignColumns: [centres.id, centres.organizationId],
    }),
  ],
);
export const leadActivities = pgTable(
  "lead_activities",
  {
    ...scope(),
    leadId: uuid("lead_id").notNull(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    kind: text("kind").notNull(),
    summary: text("summary").notNull(),
    changes: jsonb("changes")
      .$type<Record<string, { before: unknown; after: unknown }>>()
      .notNull()
      .default({}),
  },
  (t) => [
    foreignKey({
      columns: [t.leadId, t.organizationId],
      foreignColumns: [leads.id, leads.organizationId],
    }),
    index().on(t.leadId, t.createdAt),
  ],
);
export const leadFollowUps = pgTable(
  "lead_follow_ups",
  {
    ...scope(),
    leadId: uuid("lead_id").notNull(),
    assignedTo: text("assigned_to")
      .notNull()
      .references(() => user.id),
    dueAt: time("due_at").notNull(),
    action: text("action").notNull(),
    state: text("state").notNull().default("pending"),
    completedAt: time("completed_at"),
    completionNotes: text("completion_notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id),
  },
  (t) => [
    foreignKey({
      columns: [t.leadId, t.organizationId],
      foreignColumns: [leads.id, leads.organizationId],
    }),
    index().on(t.leadId, t.state, t.dueAt),
  ],
);
export const appointments = pgTable(
  "appointments",
  {
    ...scope(),
    leadId: uuid("lead_id").notNull(),
    assignedTo: text("assigned_to").references(() => user.id),
    kind: text("kind").notNull(),
    scheduledAt: time("scheduled_at").notNull(),
    completedAt: time("completed_at"),
    status: text("status").notNull().default("scheduled"),
    observations: text("observations"),
    measurements: jsonb("measurements")
      .$type<{ label: string; value: string; unit: string }[]>()
      .notNull()
      .default([]),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique().on(t.id, t.leadId, t.organizationId),
    foreignKey({
      columns: [t.leadId, t.organizationId],
      foreignColumns: [leads.id, leads.organizationId],
    }),
  ],
);
export const quotations = pgTable(
  "quotations",
  {
    ...scope(),
    leadId: uuid("lead_id").notNull(),
    revision: integer("revision").notNull().default(1),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("INR"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }),
    discount: numeric("discount", { precision: 14, scale: 2 }),
    customerNotes: text("customer_notes"),
    revisionReason: text("revision_reason"),
    createdBy: text("created_by").references(() => user.id),
    snapshot: jsonb("snapshot").$type<{
      company: string;
      client: string;
      mobile: string;
      project: string;
      address: string;
    }>(),
  },
  (t) => [
    unique().on(t.id, t.organizationId),
    unique().on(t.leadId, t.revision),
    foreignKey({
      columns: [t.leadId, t.organizationId],
      foreignColumns: [leads.id, leads.organizationId],
    }),
  ],
);
export const quotationItems = pgTable(
  "quotation_items",
  {
    ...scope(),
    quotationId: uuid("quotation_id").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
    name: text("name"),
    productCompanyId: uuid("product_company_id").references(() => organizations.id),
    position: integer("position").notNull().default(0),
    discount: numeric("discount", { precision: 14, scale: 2 }).notNull().default("0"),
    subtotal: numeric("subtotal", { precision: 14, scale: 2 }),
    amount: numeric("amount", { precision: 14, scale: 2 }),
  },
  (t) => [
    foreignKey({
      columns: [t.quotationId, t.organizationId],
      foreignColumns: [quotations.id, quotations.organizationId],
    }),
  ],
);
export const orders = pgTable(
  "orders",
  {
    ...scope(),
    leadId: uuid("lead_id").notNull(),
    customerId: uuid("customer_id").notNull(),
    centreId: uuid("centre_id").notNull(),
    assignedTo: text("assigned_to").references(() => user.id),
    stage: integer("stage").notNull().default(1),
    projectId: uuid("project_id"),
    quotationId: uuid("quotation_id"),
    finalValue: numeric("final_value", { precision: 14, scale: 2 }),
    recordedPaymentAmount: numeric("recorded_payment_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    finalQuantity: numeric("final_quantity", { precision: 14, scale: 3 }),
    completedAt: time("completed_at"),
  },
  (t) => [
    unique().on(t.id, t.organizationId),
    unique().on(t.leadId),
    check("order_stage_range", sql`${t.stage} between 1 and 16`),
    foreignKey({
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }),
    foreignKey({
      columns: [t.quotationId, t.organizationId],
      foreignColumns: [quotations.id, quotations.organizationId],
    }),
    foreignKey({
      columns: [t.leadId, t.organizationId],
      foreignColumns: [leads.id, leads.organizationId],
    }),
    foreignKey({
      columns: [t.customerId, t.organizationId],
      foreignColumns: [customers.id, customers.organizationId],
    }),
    foreignKey({
      columns: [t.centreId, t.organizationId],
      foreignColumns: [centres.id, centres.organizationId],
    }),
  ],
);
export const orderItems = pgTable(
  "order_items",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    description: text("description").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    allocatedQuantity: numeric("allocated_quantity", { precision: 12, scale: 3 })
      .notNull()
      .default("0"),
    name: text("name"),
    unitPrice: numeric("unit_price", { precision: 14, scale: 2 }),
    amount: numeric("amount", { precision: 14, scale: 2 }),
  },
  (t) => [
    unique().on(t.id, t.organizationId),
    foreignKey({
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
  ],
);
export const productionLoads = pgTable(
  "production_loads",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    loadNumber: integer("load_number").notNull(),
    status: text("status").notNull().default("planned"),
    assignedTo: text("assigned_to").references(() => user.id),
    version: integer("version").notNull().default(1),
    siteReady: boolean("site_ready").notNull().default(false),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    completedAt: time("completed_at"),
  },
  (t) => [
    unique().on(t.id, t.organizationId),
    unique().on(t.orderId, t.loadNumber),
    check("positive_load_number", sql`${t.loadNumber} > 0`),
    foreignKey({
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
  ],
);
export const productionLoadItems = pgTable(
  "production_load_items",
  {
    ...scope(),
    loadId: uuid("load_id").notNull(),
    orderItemId: uuid("order_item_id").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    installedQuantity: numeric("installed_quantity", { precision: 12, scale: 3 })
      .notNull()
      .default("0"),
    dispatchedQuantity: numeric("dispatched_quantity", { precision: 12, scale: 3 })
      .notNull()
      .default("0"),
  },
  (t) => [
    unique().on(t.id, t.organizationId),
    unique().on(t.loadId, t.orderItemId),
    unique().on(t.id, t.loadId, t.organizationId),
    check("positive_load_allocation", sql`${t.quantity} > 0`),
    foreignKey({
      columns: [t.loadId, t.organizationId],
      foreignColumns: [productionLoads.id, productionLoads.organizationId],
    }),
    foreignKey({
      columns: [t.orderItemId, t.organizationId],
      foreignColumns: [orderItems.id, orderItems.organizationId],
    }),
  ],
);
export const productionLoadEvents = pgTable(
  "production_load_events",
  {
    ...scope(),
    loadId: uuid("load_id").notNull(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    action: text("action").notNull(),
    notes: text("notes").notNull(),
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.loadId, t.organizationId],
      foreignColumns: [productionLoads.id, productionLoads.organizationId],
    }),
  ],
);
export const payments = pgTable(
  "payments",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    reference: text("reference").notNull(),
    receivedAt: time("received_at").notNull(),
    mode: text("mode").notNull().default("other"),
    status: text("status").notNull().default("pending"),
    notes: text("notes").notNull().default(""),
    recordedBy: text("recorded_by").references(() => user.id),
    verifiedBy: text("verified_by").references(() => user.id),
    verifiedAt: time("verified_at"),
    rejectionReason: text("rejection_reason"),
    allocatedAmount: numeric("allocated_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique().on(t.id, t.orderId, t.organizationId),
    check("payment_positive", sql`${t.amount}>0`),
    foreignKey({
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
  ],
);
export const paymentMilestones = pgTable(
  "payment_milestones",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    loadId: uuid("load_id").notNull(),
    name: text("name").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    allocatedAmount: numeric("allocated_amount", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    dueAt: time("due_at"),
    beforeDispatch: boolean("before_dispatch").notNull().default(true),
    contractReference: text("contract_reference").notNull(),
    notes: text("notes").notNull(),
    configuredBy: text("configured_by")
      .notNull()
      .references(() => user.id),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique().on(t.id, t.orderId, t.organizationId),
    foreignKey({
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
    foreignKey({
      columns: [t.loadId, t.organizationId],
      foreignColumns: [productionLoads.id, productionLoads.organizationId],
    }),
  ],
);
export const paymentAllocations = pgTable(
  "payment_allocations",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    paymentId: uuid("payment_id").notNull(),
    milestoneId: uuid("milestone_id").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    allocatedBy: text("allocated_by")
      .notNull()
      .references(() => user.id),
  },
  (t) => [
    unique().on(t.paymentId, t.milestoneId),
    foreignKey({
      columns: [t.paymentId, t.orderId, t.organizationId],
      foreignColumns: [payments.id, payments.orderId, payments.organizationId],
    }),
    foreignKey({
      columns: [t.milestoneId, t.orderId, t.organizationId],
      foreignColumns: [
        paymentMilestones.id,
        paymentMilestones.orderId,
        paymentMilestones.organizationId,
      ],
    }),
  ],
);
export const dispatches = pgTable(
  "dispatches",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    loadId: uuid("load_id").notNull(),
    status: text("status").notNull().default("draft"),
    dispatchedAt: time("dispatched_at"),
    reference: text("reference"),
    transporter: text("transporter"),
    vehicleNumber: text("vehicle_number"),
    expectedAt: time("expected_at"),
    notes: text("notes").notNull().default(""),
    approvedBy: text("approved_by").references(() => user.id),
    approvedAt: time("approved_at"),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique().on(t.id, t.organizationId),
    unique().on(t.id, t.orderId, t.organizationId),
    foreignKey({
      columns: [t.loadId, t.organizationId],
      foreignColumns: [productionLoads.id, productionLoads.organizationId],
    }),
    foreignKey({
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
  ],
);
export const dispatchItems = pgTable(
  "dispatch_items",
  {
    ...scope(),
    dispatchId: uuid("dispatch_id").notNull(),
    loadItemId: uuid("load_item_id").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    deliveredQuantity: numeric("delivered_quantity", { precision: 12, scale: 3 })
      .notNull()
      .default("0"),
  },
  (t) => [
    unique().on(t.id, t.organizationId),
    unique().on(t.dispatchId, t.loadItemId),
    unique().on(t.id, t.dispatchId, t.organizationId),
    foreignKey({
      columns: [t.dispatchId, t.organizationId],
      foreignColumns: [dispatches.id, dispatches.organizationId],
    }),
    foreignKey({
      columns: [t.loadItemId, t.organizationId],
      foreignColumns: [productionLoadItems.id, productionLoadItems.organizationId],
    }),
  ],
);
export const deliveries = pgTable(
  "deliveries",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    dispatchId: uuid("dispatch_id").notNull(),
    deliveredAt: time("delivered_at"),
    receivedBy: text("received_by"),
    status: text("status").notNull().default("draft"),
    remarks: text("remarks").notNull().default(""),
    confirmedBy: text("confirmed_by").references(() => user.id),
    confirmedAt: time("confirmed_at"),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique().on(t.id, t.orderId, t.organizationId),
    unique().on(t.id, t.organizationId),
    foreignKey({
      columns: [t.dispatchId, t.orderId, t.organizationId],
      foreignColumns: [dispatches.id, dispatches.orderId, dispatches.organizationId],
    }),
  ],
);
export const deliveryItems = pgTable(
  "delivery_items",
  {
    ...scope(),
    deliveryId: uuid("delivery_id").notNull(),
    dispatchItemId: uuid("dispatch_item_id").notNull(),
    received: numeric("received", { precision: 12, scale: 3 }).notNull(),
    damaged: numeric("damaged", { precision: 12, scale: 3 }).notNull().default("0"),
    missing: numeric("missing", { precision: 12, scale: 3 }).notNull().default("0"),
  },
  (t) => [
    unique().on(t.deliveryId, t.dispatchItemId),
    foreignKey({
      columns: [t.deliveryId, t.organizationId],
      foreignColumns: [deliveries.id, deliveries.organizationId],
    }),
    foreignKey({
      columns: [t.dispatchItemId, t.organizationId],
      foreignColumns: [dispatchItems.id, dispatchItems.organizationId],
    }),
  ],
);
export const commerceFiles = pgTable(
  "commerce_files",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    paymentId: uuid("payment_id"),
    dispatchId: uuid("dispatch_id"),
    deliveryId: uuid("delivery_id"),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id),
    name: text("name").notNull(),
    objectPath: text("object_path").notNull().unique(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.paymentId, t.orderId, t.organizationId],
      foreignColumns: [payments.id, payments.orderId, payments.organizationId],
    }),
    foreignKey({
      columns: [t.dispatchId, t.orderId, t.organizationId],
      foreignColumns: [dispatches.id, dispatches.orderId, dispatches.organizationId],
    }),
    foreignKey({
      columns: [t.deliveryId, t.orderId, t.organizationId],
      foreignColumns: [deliveries.id, deliveries.orderId, deliveries.organizationId],
    }),
  ],
);
export const commerceEvents = pgTable(
  "commerce_events",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    entityId: uuid("entity_id").notNull(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    action: text("action").notNull(),
    notes: text("notes").notNull(),
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
  ],
);
export const installations = pgTable(
  "installations",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    loadId: uuid("load_id"),
    assignedTo: text("assigned_to").references(() => user.id),
    teamName: text("team_name").notNull().default(""),
    teamMembers: jsonb("team_members").$type<string[]>().notNull().default([]),
    plannedAt: time("planned_at"),
    startedAt: time("started_at"),
    completedAt: time("completed_at"),
    status: text("status").notNull().default("planned"),
    remarks: text("remarks").notNull().default(""),
    version: integer("version").notNull().default(1),
    completedBy: text("completed_by").references(() => user.id),
  },
  (t) => [
    unique().on(t.id, t.organizationId),
    unique().on(t.id, t.orderId, t.organizationId),
    unique().on(t.loadId),
    foreignKey({
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
    foreignKey({
      columns: [t.loadId, t.organizationId],
      foreignColumns: [productionLoads.id, productionLoads.organizationId],
    }),
  ],
);
export const sgripGlassChecklists = pgTable(
  "sgrip_glass_checklists",
  {
    ...scope(),
    installationId: uuid("installation_id").notNull().unique(),
    glassRequired: boolean("glass_required").notNull(),
    measurementTaken: boolean("measurement_taken").notNull().default(false),
    templatePrepared: boolean("template_prepared").notNull().default(false),
    templateApproved: boolean("template_approved").notNull().default(false),
    dimensions: jsonb("dimensions")
      .$type<{ label: string; value: string; unit: string }[]>()
      .notNull()
      .default([]),
    responsibleId: text("responsible_id").references(() => user.id),
    measuredAt: time("measured_at"),
    preparedBy: text("prepared_by").references(() => user.id),
    preparedAt: time("prepared_at"),
    templateFileId: uuid("template_file_id"),
    approvedBy: text("approved_by").references(() => user.id),
    approvedAt: time("approved_at"),
    notes: text("notes").notNull().default(""),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    foreignKey({
      columns: [t.installationId, t.organizationId],
      foreignColumns: [installations.id, installations.organizationId],
    }),
    check(
      "glass_activity_order",
      sql`(${t.glassRequired} or (not ${t.measurementTaken} and not ${t.templatePrepared} and not ${t.templateApproved})) and (not ${t.templatePrepared} or ${t.measurementTaken}) and (not ${t.templateApproved} or ${t.templatePrepared})`,
    ),
  ],
);
export const installationEntries = pgTable(
  "installation_entries",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    installationId: uuid("installation_id").notNull(),
    loadItemId: uuid("load_item_id").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull(),
    occurredAt: time("occurred_at").notNull(),
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => user.id),
    remarks: text("remarks").notNull(),
    requestId: uuid("request_id").notNull().unique(),
  },
  (t) => [
    foreignKey({
      columns: [t.installationId, t.orderId, t.organizationId],
      foreignColumns: [installations.id, installations.orderId, installations.organizationId],
    }),
    foreignKey({
      columns: [t.loadItemId, t.organizationId],
      foreignColumns: [productionLoadItems.id, productionLoadItems.organizationId],
    }),
  ],
);
export const engineerAudits = pgTable(
  "engineer_audits",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    installationId: uuid("installation_id"),
    engineerId: text("engineer_id")
      .notNull()
      .references(() => user.id),
    plannedAt: time("planned_at"),
    inspectionAt: time("inspection_at"),
    notes: text("notes"),
    completedAt: time("completed_at"),
    status: text("status").notNull().default("planned"),
    checklist: jsonb("checklist")
      .$type<{ key: string; result: "pass" | "fail" | "not_applicable"; notes: string }[]>()
      .notNull()
      .default([]),
    approvedBy: text("approved_by").references(() => user.id),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique().on(t.id, t.organizationId),
    unique().on(t.id, t.orderId, t.organizationId),
    unique().on(t.installationId),
    foreignKey({
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
    foreignKey({
      columns: [t.installationId, t.orderId, t.organizationId],
      foreignColumns: [installations.id, installations.orderId, installations.organizationId],
    }),
  ],
);
export const auditPunchItems = pgTable(
  "audit_punch_items",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    auditId: uuid("audit_id").notNull(),
    description: text("description").notNull(),
    assignedTo: text("assigned_to")
      .notNull()
      .references(() => user.id),
    dueAt: time("due_at").notNull(),
    status: text("status").notNull().default("open"),
    resolution: text("resolution"),
    resolvedAt: time("resolved_at"),
    resolvedBy: text("resolved_by").references(() => user.id),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    foreignKey({
      columns: [t.auditId, t.orderId, t.organizationId],
      foreignColumns: [engineerAudits.id, engineerAudits.orderId, engineerAudits.organizationId],
    }),
  ],
);
export const handovers = pgTable(
  "handovers",
  {
    ...scope(),
    orderId: uuid("order_id").notNull().unique(),
    completedAt: time("completed_at"),
    testimonial: text("testimonial"),
    googleReviewUrl: text("google_review_url"),
    status: text("status").notNull().default("draft"),
    customerAccepted: boolean("customer_accepted").notNull().default(false),
    customerRepresentative: text("customer_representative"),
    acceptanceReference: text("acceptance_reference"),
    confirmedBy: text("confirmed_by").references(() => user.id),
    confirmedAt: time("confirmed_at"),
    notes: text("notes").notNull().default(""),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique().on(t.id, t.orderId, t.organizationId),
    foreignKey({
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
  ],
);
export const customerFeedback = pgTable(
  "customer_feedback",
  {
    ...scope(),
    orderId: uuid("order_id").notNull().unique(),
    googleRequestedAt: time("google_requested_at"),
    testimonialRequestedAt: time("testimonial_requested_at"),
    status: text("status").notNull().default("pending"),
    receivedAt: time("received_at"),
    comments: text("comments").notNull().default(""),
    testimonial: text("testimonial"),
    reviewUrl: text("review_url"),
    rating: integer("rating"),
    publicationConsent: boolean("publication_consent").notNull().default(false),
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => user.id),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    foreignKey({
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
  ],
);
export const serviceTickets = pgTable(
  "service_tickets",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    assignedTo: text("assigned_to").references(() => user.id),
    title: text("title").notNull().default("Service request"),
    description: text("description").notNull(),
    kind: text("kind").notNull().default("service"),
    priority: text("priority").notNull().default("normal"),
    dueAt: time("due_at"),
    status: text("status").notNull().default("open"),
    resolution: text("resolution"),
    resolvedAt: time("resolved_at"),
    resolvedBy: text("resolved_by").references(() => user.id),
    closedAt: time("closed_at"),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique().on(t.id, t.orderId, t.organizationId),
    foreignKey({
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
  ],
);
export const aftercareFiles = pgTable(
  "aftercare_files",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    installationId: uuid("installation_id"),
    auditId: uuid("audit_id"),
    handoverId: uuid("handover_id"),
    ticketId: uuid("ticket_id"),
    kind: text("kind").notNull(),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id),
    name: text("name").notNull(),
    objectPath: text("object_path").notNull().unique(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.installationId, t.orderId, t.organizationId],
      foreignColumns: [installations.id, installations.orderId, installations.organizationId],
    }),
    foreignKey({
      columns: [t.auditId, t.orderId, t.organizationId],
      foreignColumns: [engineerAudits.id, engineerAudits.orderId, engineerAudits.organizationId],
    }),
    foreignKey({
      columns: [t.handoverId, t.orderId, t.organizationId],
      foreignColumns: [handovers.id, handovers.orderId, handovers.organizationId],
    }),
    foreignKey({
      columns: [t.ticketId, t.orderId, t.organizationId],
      foreignColumns: [serviceTickets.id, serviceTickets.orderId, serviceTickets.organizationId],
    }),
  ],
);
export const aftercareEvents = pgTable(
  "aftercare_events",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    entityId: uuid("entity_id").notNull(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    action: text("action").notNull(),
    notes: text("notes").notNull(),
    before: jsonb("before").$type<Record<string, unknown> | null>(),
    after: jsonb("after").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
  ],
);
export const documents = pgTable(
  "documents",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id),
    name: text("name").notNull(),
    objectPath: text("object_path").notNull().unique(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    stageNumber: integer("stage_number"),
    requirementId: uuid("requirement_id"),
  },
  (t) => [
    foreignKey({
      columns: [t.requirementId, t.organizationId],
      foreignColumns: [adminCatalog.id, adminCatalog.organizationId],
    }),
    foreignKey({
      columns: [t.orderId, t.stageNumber, t.organizationId],
      foreignColumns: [orderStages.orderId, orderStages.number, orderStages.organizationId],
    }),
    foreignKey({
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
  ],
);
export const workflowEvents = pgTable(
  "workflow_events",
  {
    ...scope(),
    orderId: uuid("order_id"),
    leadId: uuid("lead_id"),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    fromStage: integer("from_stage"),
    toStage: integer("to_stage").notNull(),
    notes: text("notes"),
  },
  (t) => [
    check("workflow_one_parent", sql`(${t.orderId} is null) <> (${t.leadId} is null)`),
    foreignKey({
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
    foreignKey({
      columns: [t.leadId, t.organizationId],
      foreignColumns: [leads.id, leads.organizationId],
    }),
  ],
);
export const auditLogs = pgTable("audit_logs", {
  ...identity(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  actorId: text("actor_id").references(() => user.id),
  targetId: text("target_id"),
  action: text("action").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
});

export const quotationDecisions = pgTable(
  "quotation_decisions",
  {
    ...scope(),
    quotationId: uuid("quotation_id").notNull(),
    decision: text("decision").notNull(),
    evidence: text("evidence").notNull(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
  },
  (t) => [
    foreignKey({
      columns: [t.quotationId, t.organizationId],
      foreignColumns: [quotations.id, quotations.organizationId],
    }),
    index().on(t.quotationId, t.createdAt),
  ],
);

export const salesEngagements = pgTable(
  "sales_engagements",
  {
    ...scope(),
    leadId: uuid("lead_id").notNull(),
    kind: text("kind").notNull(),
    occurredAt: time("occurred_at").notNull(),
    outcome: text("outcome").notNull(),
    notRequired: boolean("not_required").notNull().default(false),
    reason: text("reason"),
    notes: text("notes").notNull(),
    offeredValue: numeric("offered_value", { precision: 14, scale: 2 }),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
  },
  (t) => [
    foreignKey({
      columns: [t.leadId, t.organizationId],
      foreignColumns: [leads.id, leads.organizationId],
    }),
    index().on(t.leadId, t.createdAt),
  ],
);

export const presalesAttachments = pgTable(
  "presales_attachments",
  {
    ...scope(),
    leadId: uuid("lead_id").notNull(),
    appointmentId: uuid("appointment_id"),
    name: text("name").notNull(),
    objectPath: text("object_path").notNull().unique(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id),
  },
  (t) => [
    foreignKey({
      columns: [t.leadId, t.organizationId],
      foreignColumns: [leads.id, leads.organizationId],
    }),
    foreignKey({
      columns: [t.appointmentId, t.leadId, t.organizationId],
      foreignColumns: [appointments.id, appointments.leadId, appointments.organizationId],
    }),
    index().on(t.leadId, t.createdAt),
  ],
);

export const orderStagePolicies = pgTable(
  "order_stage_policies",
  {
    ...scope(),
    number: integer("number").notNull(),
    ownerRole: employeeRole("owner_role").notNull(),
    approverRole: employeeRole("approver_role").notNull(),
    requiredFields: jsonb("required_fields").$type<string[]>().notNull(),
    version: integer("version").notNull().default(1),
    changedBy: text("changed_by")
      .notNull()
      .references(() => user.id),
  },
  (t) => [
    unique().on(t.organizationId, t.number),
    check("policy_stage_range", sql`${t.number} between 1 and 16`),
  ],
);

export const orderStages = pgTable(
  "order_stages",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    number: integer("number").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("pending"),
    ownerRole: employeeRole("owner_role").notNull(),
    approverRole: employeeRole("approver_role").notNull(),
    requiredFields: jsonb("required_fields").$type<string[]>().notNull(),
    documentRequirements: jsonb("document_requirements")
      .$type<{ id: string; name: string }[]>()
      .notNull()
      .default([]),
    assignedTo: text("assigned_to").references(() => user.id),
    plannedAt: time("planned_at"),
    startedAt: time("started_at"),
    submittedAt: time("submitted_at"),
    submittedBy: text("submitted_by").references(() => user.id),
    completedAt: time("completed_at"),
    approvedBy: text("approved_by").references(() => user.id),
    notes: text("notes").notNull().default(""),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    version: integer("version").notNull().default(1),
  },
  (t) => [
    unique().on(t.orderId, t.number),
    unique().on(t.orderId, t.number, t.organizationId),
    unique().on(t.id, t.orderId, t.organizationId),
    foreignKey({
      columns: [t.orderId, t.organizationId],
      foreignColumns: [orders.id, orders.organizationId],
    }),
    index().on(t.assignedTo, t.status, t.plannedAt),
    check("order_stage_number", sql`${t.number} between 1 and 16`),
  ],
);

export const orderStageEvents = pgTable(
  "order_stage_events",
  {
    ...scope(),
    orderId: uuid("order_id").notNull(),
    stageId: uuid("stage_id").notNull(),
    action: text("action").notNull(),
    actorId: text("actor_id")
      .notNull()
      .references(() => user.id),
    notes: text("notes").notNull().default(""),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    foreignKey({
      columns: [t.stageId, t.orderId, t.organizationId],
      foreignColumns: [orderStages.id, orderStages.orderId, orderStages.organizationId],
    }),
    index().on(t.orderId, t.createdAt),
  ],
);

// Company-owned configuration is versioned and soft-disabled; historical references survive edits.
export const adminCatalog = pgTable(
  "admin_catalog",
  {
    ...scope(),
    kind: text("kind").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    version: integer("version").notNull().default(1),
    changedBy: text("changed_by")
      .notNull()
      .references(() => user.id),
  },
  (t) => [
    unique().on(t.id, t.organizationId),
    unique().on(t.organizationId, t.kind, t.code),
    index().on(t.organizationId, t.kind, t.active),
  ],
);
export const notificationReceipts = pgTable(
  "notification_receipts",
  {
    ...scope(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    kind: text("kind").notNull(),
    entityId: uuid("entity_id").notNull(),
    dueAt: time("due_at").notNull(),
    state: text("state").notNull(),
  },
  (t) => [unique().on(t.userId, t.kind, t.entityId), index().on(t.userId, t.state)],
);
