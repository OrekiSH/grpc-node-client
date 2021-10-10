import {
  loadPackageDefinition,
  ChannelCredentials,
  ClientOptions,
  GrpcObject,
  credentials,
  Metadata,
  Client,
} from '@grpc/grpc-js';
import { ClientUnaryCallImpl } from '@grpc/grpc-js/build/src/call';
import { Http2CallStream } from '@grpc/grpc-js/build/src/call-stream';
import { Status } from '@grpc/grpc-js/build/src/constants';
import { loadSync, Options as LoadOptions } from '@grpc/proto-loader';
import EventEmitter from 'events';
// @ts-ignore
import createMetadata from 'grpc-create-metadata';

export interface GrpcNodeClientConfig {
  url: string // ip address/dns name:port
  protoPath: string | string[]
  serviceName: string
  package?: string

  credentials?: ChannelCredentials
  clientOptions?: ClientOptions
  loadOptions?: LoadOptions

  retry?: number
}

export interface GrpcNodeClientRequestOptions<T, P> {
  method: P
  // @ts-ignore
  params: Partial<Parameters<T[P]>[0]>
  metadata?: Record<string, string> | Metadata
}

export interface CancelHandler {
  cancel: (detail?: string) => void;
  isCanceled: () => boolean
}

export default class GrpcNodeClient<T> extends EventEmitter {
  private config: GrpcNodeClientConfig | undefined;

  private grpcObject: GrpcObject | undefined;

  constructor(config: GrpcNodeClientConfig) {
    super();
    this.config = config;
    try {
      const pkgDef = loadSync(config.protoPath, config.loadOptions);
      this.grpcObject = loadPackageDefinition(pkgDef);
    } catch (err) {
      this.emit('error', err);
    }
  }

  request<P extends keyof T>(
    opts: GrpcNodeClientRequestOptions<T, P>,
    // @ts-ignore
  ): ReturnType<T[P]> & CancelHandler {
    const { method, params, metadata } = opts;

    let call: Http2CallStream | null = null;
    const { retry } = this.config || {};
    let retryCount = typeof retry === 'undefined' ? 2 : retry;
    // @ts-ignore
    const promise = new Promise((resolve, reject) => {
      if (!this.grpcObject) return;

      try {
        const conf = this.config;
        const serviceClient = conf?.package
          ? this.grpcObject[conf?.package]
          : this.grpcObject;
        // @ts-ignore
        const client = new serviceClient[conf?.serviceName](
          conf?.url,
          conf?.credentials || credentials.createInsecure(),
          conf?.clientOptions,
        ) as Client;

        const meta = metadata instanceof Metadata
          ? metadata
          : createMetadata(metadata);

        // eslint-disable-next-line no-inner-declarations
        function makeRequest() {
          // @ts-ignore
          const callImpl = client[method](params, meta, (err: Error, res: ReturnType<T[P]>) => {
            if (err) {
              if (retryCount <= 0) {
                call = null;
                reject(err);
              } else {
                retryCount -= 1;
                const delay = 1000 * (2 ** (retryCount - 1)) + Math.random() * 100;
                setTimeout(() => {
                  makeRequest();
                }, delay);
              }
            } else {
              call = null;
              resolve(res);
            }
          }) as ClientUnaryCallImpl;

          // @ts-ignore
          call = callImpl.call?.call;
        }

        makeRequest();
      } catch (err) {
        this.emit('error', err);
      }
    // @ts-ignore
    }) as ReturnType<T[P]> & CancelHandler;

    function isCanceled() {
      return call
        ? call.getStatus()?.code !== Status.CANCELLED
        : false;
    }

    promise.cancel = function cancel(detail?: string) {
      if (call && isCanceled()) {
        call.cancelWithStatus(Status.CANCELLED, detail || 'Cancelled by user');
      }
    };

    promise.isCanceled = isCanceled;

    return promise;
  }
}
