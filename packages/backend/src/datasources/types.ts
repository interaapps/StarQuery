export type DataSourceType =
  | "mysql"
  | "mariadb"
  | "postgres"
  | "cockroachdb"
  | "sqlite"
  | "duckdb"
  | "mssql"
  | "clickhouse"
  | "oracle"
  | "mongodb"
  | "redis"
  | "convex"
  | "cassandra"
  | "elasticsearch"
  | "s3"
  | "minio";

export type DataSourceKind = "sql" | "search" | "objectStorage" | "resource";

export type DataSourceCapabilities = {
  sqlQuery: boolean;
  queryConsole?: boolean;
  tableBrowser: boolean;
  dataEditor: boolean;
  schemaEditor: boolean;
  tableCreate?: boolean;
  resourceBrowser: boolean;
};

export type DataSourceDefinition = {
  type: DataSourceType;
  kind: DataSourceKind;
  label: string;
  icon: string;
  localOnly?: boolean;
  capabilities: DataSourceCapabilities;
};

export type DataSourceConfig =
  | {
      host: string;
      port: number;
      user: string;
      password: string;
      database: string;
      schema?: string;
      ssl?: boolean;
      options?: Record<string, unknown>;
    }
  | {
      filePath: string;
    }
  | {
      node: string;
      username?: string;
      password?: string;
      apiKey?: string;
      index?: string;
    }
  | {
      endPoint: string;
      port: number;
      useSSL: boolean;
      accessKey: string;
      secretKey: string;
      region?: string;
      bucket?: string;
      sessionToken?: string;
      pathStyle?: boolean;
    }
  | {
      connectionString?: string;
      host: string;
      port: number;
      user?: string;
      password?: string;
      database?: string;
      schema?: string;
      ssl?: boolean;
      options?: Record<string, unknown>;
    }
  | {
      uri?: string;
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      database?: string | number;
      authSource?: string;
      ssl?: boolean;
      options?: Record<string, unknown>;
    }
  | {
      deploymentUrl: string;
      adminKey?: string;
      authToken?: string;
    };

export type ResourceBrowserItem = {
  id: string;
  name: string;
  kind: "container" | "item";
  path: string;
  description?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ResourceBrowserDetails = {
  name: string;
  kind: "container" | "item";
  path: string;
  contentType?: string | null;
  size?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  etag?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ResourceBrowserPreview =
  | {
      type: "json";
      title: string;
      value: unknown;
    }
  | {
      type: "table";
      title: string;
      columns: string[];
      rows: Record<string, unknown>[];
    }
  | {
      type: "text";
      title: string;
      text: string;
    };

export type ResourceBrowserPage = {
  returned: number;
  hasMore: boolean;
  nextCursor?: string | null;
};

export type ResourceBrowserListing = {
  path: string;
  items: ResourceBrowserItem[];
  preview?: ResourceBrowserPreview | null;
  details?: ResourceBrowserDetails | null;
  page?: ResourceBrowserPage | null;
};
