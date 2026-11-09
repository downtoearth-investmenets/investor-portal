import { apiDownload, apiFetch } from '@/shared/lib/api-client';
import { saveBlob } from '@/shared/lib/download';
import { reportQuery, type ReportDocument, type ReportType } from '../model/report.model';

export interface InvestorChoice {
  id: string;
  fullName: string;
  entityName?: string;
}

interface ReportParams {
  type: ReportType;
  from?: string;
  to?: string;
  investorId?: string;
}

export const reportRepo = {
  preview: (params: ReportParams) => apiFetch<ReportDocument>(reportQuery(params)),
  downloadCsv: async (params: ReportParams) => {
    const { blob, filename } = await apiDownload(reportQuery({ ...params, format: 'csv' }));
    saveBlob(blob, filename);
    return filename;
  },
  investors: async (): Promise<InvestorChoice[]> => {
    const rows = await apiFetch<InvestorChoice[]>('/users/investors');
    return rows.map(({ id, fullName, entityName }) => ({ id, fullName, entityName }));
  }
};

