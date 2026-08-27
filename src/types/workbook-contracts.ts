export type WorkbookId = 'circle' | 'cylinder' | 'cone';

export interface CatalogBook {
  id: WorkbookId;
  manifest: string;
}

export interface WorkbookCatalog {
  schemaVersion: number;
  projectId: string;
  title: string;
  books: readonly CatalogBook[];
}

export interface WorkbookIdentity {
  nameField: boolean;
  dateField: boolean;
}

export interface SimpleWorkbookManifest {
  schemaVersion: number;
  id: Exclude<WorkbookId, 'cone'>;
  label: string;
  pageCount: number;
  sourceType: 'numbered-html-series';
  folder: 'circle' | 'cylinder';
  pagePattern: string;
  pageRange: {
    start: number;
    end: number;
  };
  identity: WorkbookIdentity;
  a4UtilizationMaxBlankPx: number;
}

export interface ConeWorksheet {
  id: number;
  slug: string;
  title: string;
  subtitle?: string;
  sourceId?: string;
  contentLocked?: boolean;
}

export interface ConeVisualPage {
  slug: string;
  title: string;
  type?: string;
  sceneAsset?: string;
  creditRequired?: boolean;
}

export type ConePrintEntry =
  | { kind: 'worksheet'; id: number }
  | { kind: 'visual'; slug: string };

export interface ConeWorkbookManifest {
  project: 'חרוט';
  pageCount: 38;
  visualPageCount: 8;
  printSheetCount: 46;
  pages: readonly ConeWorksheet[];
  visualPages: readonly ConeVisualPage[];
  printSequence: readonly ConePrintEntry[];
}

export interface RuntimeCounts {
  circlePages: 93;
  cylinderPages: 41;
  conePages: 46;
  totalPages: 180;
}

export function assertWorkbookId(value: string): asserts value is WorkbookId {
  if (value !== 'circle' && value !== 'cylinder' && value !== 'cone') {
    throw new Error(`Unknown workbook id: ${value}`);
  }
}
