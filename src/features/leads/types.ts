import type { leadService } from "@/lib/leads/service";
export type Serialized<T> = T extends Date
  ? string
  : T extends (infer V)[]
    ? Serialized<V>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;
type Service = ReturnType<typeof leadService>;
export type Directory = Serialized<Awaited<ReturnType<Service["directory"]>>>;
export type LeadDetail = Serialized<Awaited<ReturnType<Service["detail"]>>>;
export type LeadRow = LeadDetail["lead"];
export type LeadList = Serialized<Awaited<ReturnType<Service["list"]>>>;
export type LeadBoard = Serialized<Awaited<ReturnType<Service["board"]>>>;
export type Summary = Awaited<ReturnType<Service["summary"]>>;
export type CustomerList = Serialized<Awaited<ReturnType<Service["customers"]>>>;
export type ProjectList = Serialized<Awaited<ReturnType<Service["projects"]>>>;
