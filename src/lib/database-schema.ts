export type DatabaseColumn = {
  name: string;
  definition: string;
};

export type DatabaseForeignKey = {
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
};

export type DatabaseTable = {
  name: string;
  columns: DatabaseColumn[];
  foreignKeys: DatabaseForeignKey[];
};

export type DatabaseSchemaData = {
  tables: DatabaseTable[];
  views: string[];
};

const parseIdentifierList = (value: string) => value
  .split(',')
  .map((entry) => entry.replace(/`/g, '').trim())
  .filter(Boolean);

export function parseDatabaseSchema(source: string): DatabaseSchemaData {
  const tables: DatabaseTable[] = [];
  const tableMatches = source.matchAll(/CREATE TABLE `([^`]+)` \(([\s\S]*?)\)\s*ENGINE=/g);
  for (const match of tableMatches) {
    const name = match[1];
    const body = match[2];
    const columns: DatabaseColumn[] = [];
    const foreignKeys: DatabaseForeignKey[] = [];
    const lines = body.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines) {
      const columnMatch = line.match(/^`([^`]+)`\s+(.+?)(?:,)?$/);
      if (columnMatch) {
        columns.push({
          name: columnMatch[1],
          definition: columnMatch[2].replace(/,$/, '')
        });
        continue;
      }
      const fkMatch = line.match(/FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s*`([^`]+)`\s*\(([^)]+)\)/i);
      if (fkMatch) {
        foreignKeys.push({
          columns: parseIdentifierList(fkMatch[1]),
          referencedTable: fkMatch[2],
          referencedColumns: parseIdentifierList(fkMatch[3])
        });
      }
    }
    tables.push({
      name,
      columns,
      foreignKeys
    });
  }
  const viewMatches = source.matchAll(/VIEW `([^`]+)` AS/gi);
  const viewSet = new Set<string>();
  for (const match of viewMatches) {
    viewSet.add(match[1]);
  }
  return {
    tables: tables.sort((a, b) => a.name.localeCompare(b.name)),
    views: Array.from(viewSet).sort((a, b) => a.localeCompare(b))
  };
}
