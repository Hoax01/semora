export function formatCatalogueImportFailure(error: unknown): string {
  if (error instanceof SyntaxError) {
    return 'Catalogue file is not valid JSON.';
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Unknown catalogue import error.';
}
