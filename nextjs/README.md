# Hunger Games

## todo

- model each game as a single store
- have a wrapper for an entire game which holds the newest state of each game
- game states are separated into:
  - player connection state
  - game state
  - multiple timer states
- a game should be testable via vitest through WS and clerk being active
  - need to figure out how to mock the timers
  - need to figure out how to provide create clerk test users tokens programmatically
  - need a helper to open WS connections in the tests
