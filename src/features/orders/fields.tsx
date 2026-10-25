"use client";
import { useId, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { selectClass, localInput, utcInput } from "@/features/leads/utils";
import type { StageField } from "@/lib/orders/definitions";
export function Labeled({
  label,
  children,
}: {
  label: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className="block text-xs font-medium">
        {label}
      </label>
      {children(id)}
    </div>
  );
}
type Measurement = { label: string; value: string; unit: string };
function Measurements({
  value,
  onChange,
}: {
  value: Measurement[];
  onChange: (rows: Measurement[]) => void;
}) {
  return (
    <div className="space-y-3">
      {value.map((row, index) => (
        <div key={index} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-3">
          <Labeled label={`Measurement ${index + 1} label`}>
            {(id) => (
              <Input
                id={id}
                value={row.label}
                maxLength={120}
                onChange={(e) =>
                  onChange(value.map((m, i) => (i === index ? { ...m, label: e.target.value } : m)))
                }
              />
            )}
          </Labeled>
          <Labeled label={`Measurement ${index + 1} value`}>
            {(id) => (
              <Input
                id={id}
                inputMode="decimal"
                value={row.value}
                onChange={(e) =>
                  onChange(value.map((m, i) => (i === index ? { ...m, value: e.target.value } : m)))
                }
              />
            )}
          </Labeled>
          <Labeled label={`Measurement ${index + 1} unit`}>
            {(id) => (
              <select
                id={id}
                className={selectClass}
                value={row.unit}
                onChange={(e) =>
                  onChange(value.map((m, i) => (i === index ? { ...m, unit: e.target.value } : m)))
                }
              >
                {["mm", "cm", "m", "ft", "in", "sq ft", "sq m", "count"].map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            )}
          </Labeled>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <Trash2 size={13} />
            Remove measurement {index + 1}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={value.length >= 100}
        onClick={() => onChange([...value, { label: "", value: "", unit: "mm" }])}
      >
        <Plus size={13} />
        Add measurement
      </Button>
    </div>
  );
}
export function StageFieldInput({
  field,
  value,
  onChange,
  required,
}: {
  field: StageField;
  value: unknown;
  onChange: (value: unknown) => void;
  required: boolean;
}) {
  const label = field.label + (required ? " *" : "");
  if (field.type === "measurements")
    return (
      <fieldset className="space-y-3">
        <legend className="mb-3 text-xs font-semibold">{label}</legend>
        <Measurements
          value={Array.isArray(value) ? (value as Measurement[]) : []}
          onChange={onChange}
        />
      </fieldset>
    );
  return (
    <Labeled label={label}>
      {(id) => {
        if (field.type === "boolean")
          return (
            <select
              id={id}
              className={selectClass}
              value={typeof value === "boolean" ? String(value) : ""}
              onChange={(e) => onChange(e.target.value === "" ? "" : e.target.value === "true")}
            >
              <option value="">Choose Yes or No</option>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          );
        if (field.type === "select")
          return (
            <select
              id={id}
              className={selectClass}
              value={String(value ?? "")}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="">Select outcome</option>
              {field.options?.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          );
        if (field.type === "textarea")
          return (
            <textarea
              id={id}
              className="min-h-24 w-full rounded-lg border bg-white p-3 text-sm"
              value={String(value ?? "")}
              maxLength={4000}
              onChange={(e) => onChange(e.target.value)}
            />
          );
        return (
          <Input
            id={id}
            type={
              field.type === "datetime"
                ? "datetime-local"
                : field.type === "url"
                  ? "url"
                  : field.type === "integer"
                    ? "number"
                    : "text"
            }
            inputMode={field.type === "amount" ? "decimal" : undefined}
            value={
              field.type === "datetime"
                ? localInput(typeof value === "string" && value ? value : null)
                : String(value ?? "")
            }
            onChange={(e) =>
              onChange(field.type === "datetime" ? utcInput(e.target.value) : e.target.value)
            }
            maxLength={field.type === "url" ? 2000 : 200}
            min={field.type === "integer" ? 1 : undefined}
            max={field.type === "integer" ? 100 : undefined}
          />
        );
      }}
    </Labeled>
  );
}
