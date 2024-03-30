import { fightTests } from "./fight";
import { rpsTests } from "./rps";
import { provideTestUsers } from "./utils";

// this file is needed as otherwise all test files would be run in parallel
// and this would make it difficult to decide when the users should be created
// and when they should be removed again
provideTestUsers();
fightTests();
rpsTests();
