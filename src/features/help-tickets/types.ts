import type { helpService } from "@/lib/help-tickets/service";
type Json<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Json<U>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;
type Service = ReturnType<typeof helpService>;
export type Directory = Json<Awaited<ReturnType<Service["directory"]>>>;
export type TicketDetail = Json<Awaited<ReturnType<Service["detail"]>>>;
export type TicketList = Json<Awaited<ReturnType<Service["list"]>>>;
export type Context = Json<Awaited<ReturnType<Service["context"]>>>;
export type Policy = Context["policies"][number];
