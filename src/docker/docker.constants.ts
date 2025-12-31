export const DOCKER_EVENTS = {
  LOG_RECEIVED: 'docker.log.received',
  STREAM_STARTED: 'docker.stream.started',
  STREAM_ENDED: 'docker.stream.ended',
  STREAM_ERROR: 'docker.stream.error',
  STREAM_FAILED: 'docker.stream.failed',
  CONTAINER_NOT_FOUND: 'docker.container.not_found',
  CONTAINER_RECONNECTED: 'docker.container.reconnected',
} as const;

export type DockerEvent = (typeof DOCKER_EVENTS)[keyof typeof DOCKER_EVENTS];
