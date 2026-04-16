interface MedicalDisclaimerProps {
  title: string;
  body: string;
  className?: string;
}

export function MedicalDisclaimer({ title, body, className = '' }: MedicalDisclaimerProps) {
  return (
    <div className={`rounded-2xl border border-slate-200/70 bg-slate-50/80 px-4 py-3 text-left dark:border-slate-700 dark:bg-slate-900/30 ${className}`}>
      <div className="flex items-start gap-2.5">
        <span className="material-symbols-outlined mt-0.5 text-[16px] text-slate-400" aria-hidden="true">
          info
        </span>
        <div className="space-y-1">
          <p className="text-[11px] font-black text-slate-500 dark:text-slate-400">{title}</p>
          <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 break-keep">
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}
