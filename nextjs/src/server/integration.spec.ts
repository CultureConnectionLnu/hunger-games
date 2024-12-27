import { webSocketConnectionTests } from "./web-socket-connection_spec";

/**
 * All tests within one file are executed sequentially.
 * Because the services are global, it's not possible to run them in parallel.
 * So, all integration tests need to be imported here to be executed.
 */
webSocketConnectionTests();
