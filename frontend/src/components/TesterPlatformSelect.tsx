"use client";

import { useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TesterPlatformIcon, testerPlatformOptions } from "@/components/TesterPlatformIcon";

type TesterPlatformSelectProps = {
  id: string;
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
};

export function TesterPlatformSelect({
  id,
  name,
  label,
  defaultValue = "",
  required = false,
}: TesterPlatformSelectProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(defaultValue);

  return (
    <div data-tester-platform-select>
      <label id={`${id}-label`} htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}{required && <span className="ml-1 text-rose-300" aria-hidden="true">*</span>}
      </label>
      <Select name={name} required={required} value={value} onValueChange={setValue}>
        <SelectTrigger
          id={id}
          aria-labelledby={`${id}-label`}
          aria-required={required}
          className="h-12 w-full rounded-xl border-midnight-border bg-midnight-deep/70 px-3 text-sm text-ink shadow-sm transition hover:border-emerald-300/35 focus-visible:border-emerald-300/50 focus-visible:ring-2 focus-visible:ring-emerald-300/15"
        >
          <SelectValue placeholder={t("testerApplications.form.choosePlatform")} />
        </SelectTrigger>
        <SelectContent
          align="start"
          className="w-[var(--radix-select-trigger-width)] min-w-56 rounded-xl border-midnight-border bg-midnight-card p-1.5 shadow-2xl shadow-black/30"
        >
          {testerPlatformOptions.map(({ value, label: labelKey }) => (
            <SelectItem
              key={value}
              value={value}
              className="min-h-11 rounded-lg px-3 py-2 text-sm text-ink focus:bg-midnight-deep focus:text-ink"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-300/10 text-emerald-200" aria-hidden="true">
                <TesterPlatformIcon platform={value} size={15} />
              </span>
              <span>{t(`testerApplications.form.${labelKey}`)}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
