declare interface DurableObject {
  fetch(request: Request): Promise<Response>;
}

declare interface DurableObjectState {
  id: { toString(): string };
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
  };
}

declare interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
}

declare interface DurableObjectId {}

declare type EventContext<E = unknown, P extends string = string, D = unknown> = {
  request: Request;
  env: E;
  params: Record<P, string | string[]>;
  data: D;
};

declare type PagesFunction<E = unknown> = (context: EventContext<E, string, unknown>) => Response | Promise<Response>;
