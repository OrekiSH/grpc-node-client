<h1 style="text-align: center">grpc-node-client</h1>

Human-friendly gRPC request library for Node.js.

## Feature

- Request cancelation
- Retries on failure

## Option

``` ts
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
```

## Usage

``` proto
// hello.proto
syntax = "proto3";

// The greeting service definition.
service Greeter {
  // Sends a greeting
  rpc SayHello (HelloRequest) returns (HelloReply) {}
}

// The request message containing the user's name.
message HelloRequest {
  string name = 1;
}

// The response message containing the greetings
message HelloReply {
  string message = 1;
}
```

``` ts
// hello.ts (generated by protoc and ts-proto)
/* eslint-disable */
export const protobufPackage = "";

/** The request message containing the user's name. */
export interface HelloRequest {
  name: string;
}

/** The response message containing the greetings */
export interface HelloReply {
  message: string;
}

/** The greeting service definition. */
export interface Greeter {
  /** Sends a greeting */
  SayHello(request: HelloRequest): Promise<HelloReply>;
}
```

``` js
// client.js
import { Greeter } from './hello';
import GrpcNodeClient from 'grpc-node-client';

const client = new GrpcNodeClient<Greeter>({
  url: '0.0.0.0:50051',
  protoPath: './hello.proto',
  serviceName: 'Greeter',
})

const request = client.request({
  method: 'SayHello',
  params: { name: 'a' },
  metadata: { foo: 'bar' },
}).then((res) => {
  console.log(res); // print "Hello a"
});

// And you can cancel this request or check if this request is canceled.
// request.cancel();
// request.isCanceled();
```

``` js
// server.js
const grpc = require('@grpc/grpc-js');
const { loadSync } = require('@grpc/proto-loader');

const proto = grpc.loadPackageDefinition(
  loadSync('./hello.proto', { defaults: true });
)

function sayHello(call, callback) {
  console.warn(call.metadata.get('foo')); // print "bar"
  callback(null, { message: 'Hello ' + call.request.name });
}

function main() {
  var server = new grpc.Server();
  server.addService(proto.Greeter.service, { sayHello });
  server.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
    server.start();
  });
}

main();
```

