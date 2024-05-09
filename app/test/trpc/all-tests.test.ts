import { lobbyTests } from "./lobby";
import { questTests } from "./quest";
import { rpsTests } from "./rps";
import { scoreTests } from "./score";
import { provideTestUsers } from "./utils";

// this file is needed as otherwise all test files would be run in parallel
// and this would make it difficult to decide when the users should be created
// and when they should be removed again
provideTestUsers();
lobbyTests();
rpsTests();
scoreTests();
questTests();
