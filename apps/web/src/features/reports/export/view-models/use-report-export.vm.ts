'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useSession } from '@/shared/auth';
import { toErrorMessage } from '@/shared/lib/api-client';
import { useResource } from '@/shared/lib/use-resource';
import { useToast } from '@/shared/ui/Toast';
import { reportRepo } from '../data/report.repo';
import {
  defaultPreset,
  optionsFor,
  periodProblem,
  presetRange,
  presetsFor,
  type ReportOption,
  type ReportType
} from '../model/report.model';

export function useReportExportViewModel() {
  const { user } = useSession();
  const toast = useToast();
  const searchParams = useSearchParams();
  const audience = user?.role === 'admin' ? 'admin' : 'investor';
  const options = optionsFor(audience);

  const initial = options.find(option => option.type === searchParams.get('type')) ?? options[0];
  const [type, setType] = useState<ReportType>(initial.type);
  const [preset, setPreset] = useState(defaultPreset(initial));
  const [custom, setCustom] = useState(() => presetRange(defaultPreset(initial), new Date()) ?? { from: '', to: '' });
  const [investorId, setInvestorId] = useState(searchParams.get('investor') ?? '');
  const [downloading, setDownloading] = useState(false);

  const option = options.find(item => item.type === type) ?? options[0];
  const investors = useResource(reportRepo.investors, audience === 'admin' ? 'investors' : null);

  const range = option.period === 'none' ? null : preset === 'custom' ? custom : presetRange(preset, new Date());
  const rangeError = range ? periodProblem(range.from, range.to) : null;
  const needsChoice = audience === 'admin' && option.needsInvestor && !investorId;

  const params = useMemo(
    () => ({
      type,
      from: range?.from,
      to: range?.to,
      investorId: audience === 'admin' && investorId ? investorId : undefined
    }),
    [type, range?.from, range?.to, audience, investorId]
  );
  const key = rangeError || needsChoice ? null : JSON.stringify(params);
  const preview = useResource(() => reportRepo.preview(params), key);

  const chooseType = (next: ReportOption) => {
    setType(next.type);
    const nextPreset = defaultPreset(next);
    setPreset(nextPreset);
    const nextRange = presetRange(nextPreset, new Date());
    if (nextRange) setCustom(nextRange);
  };

  const choosePreset = (id: string) => {
    if (id === 'custom' && range) setCustom(range);
    setPreset(id);
  };

  const downloadCsv = async () => {
    if (!key) return;
    setDownloading(true);
    try {
      const filename = await reportRepo.downloadCsv(params);
      toast(`Downloaded ${filename}`);
    } catch (err) {
      toast(toErrorMessage(err), 'error');
    } finally {
      setDownloading(false);
    }
  };

  // The browser's print dialog saves the preview as a PDF; the title becomes the file name.
  const savePdf = () => {
    const report = preview.data;
    if (!report) return;
    const previous = document.title;
    document.title = ['Down to Earth', report.title, report.subject, report.period ? `${report.period.from} to ${report.period.to}` : '']
      .filter(Boolean)
      .join(' - ');
    window.print();
    document.title = previous;
  };

  return {
    audience,
    options,
    option,
    chooseType,
    presets: presetsFor(option),
    preset,
    choosePreset,
    custom,
    setCustomFrom: (from: string) => setCustom(current => ({ ...current, from })),
    setCustomTo: (to: string) => setCustom(current => ({ ...current, to })),
    rangeError,
    investorId,
    setInvestorId,
    investorOptions: investors.data ?? [],
    investorsStatus: investors.status,
    needsChoice,
    status: key ? preview.status : ('idle' as const),
    error: preview.error,
    retry: preview.reload,
    report: key ? preview.data : null,
    canExport: Boolean(key && preview.status === 'ready'),
    downloading,
    downloadCsv,
    savePdf
  };
}

