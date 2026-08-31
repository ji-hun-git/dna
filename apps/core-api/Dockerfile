# syntax=docker/dockerfile:1.7

FROM eclipse-temurin:21-jdk-jammy@sha256:ce5767b7222312d42395f5bab033cd91f09e44032a2f21bdfd7b5b912dbe1e77 AS build
WORKDIR /workspace

COPY . .
RUN for attempt in 1 2 3; do \
      ./gradlew :apps:core-api:bootJar --no-daemon && exit 0; \
      if [ "$attempt" -eq 3 ]; then exit 1; fi; \
      sleep "$((attempt * 10))"; \
    done

FROM eclipse-temurin:21-jre-jammy@sha256:eebd356ad7358b7094758e5787a6726f332917cfd56feab6457c56dab895cdbf AS runtime
WORKDIR /app

RUN groupadd --gid 10001 genome-companion \
    && useradd --uid 10001 --gid genome-companion --no-create-home --shell /usr/sbin/nologin genome-companion
COPY --from=build --chown=10001:10001 /workspace/apps/core-api/build/libs/core-api.jar /app/core-api.jar

USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-Djava.io.tmpdir=/tmp", "-jar", "/app/core-api.jar"]
