# syntax=docker/dockerfile:1.7

FROM eclipse-temurin:21-jdk-jammy@sha256:ce5767b7222312d42395f5bab033cd91f09e44032a2f21bdfd7b5b912dbe1e77 AS build
WORKDIR /workspace

COPY . .
RUN for attempt in 1 2 3; do \
      ./gradlew :apps:document-worker:installDist --no-daemon && exit 0; \
      if [ "$attempt" -eq 3 ]; then exit 1; fi; \
      sleep "$((attempt * 10))"; \
    done

FROM eclipse-temurin:21-jre-jammy@sha256:eebd356ad7358b7094758e5787a6726f332917cfd56feab6457c56dab895cdbf AS clamav
ADD --checksum=sha256:28d6efc5b4423e7830c3559339552eb53870a9eac51ac4efb37d60530d329886 \
    https://github.com/Cisco-Talos/clamav/releases/download/clamav-1.5.4/clamav-1.5.4.linux.x86_64.deb \
    /tmp/clamav-1.5.4.deb
RUN mkdir --parents /opt/clamav \
    && dpkg-deb --extract /tmp/clamav-1.5.4.deb /opt/clamav

FROM eclipse-temurin:21-jre-jammy@sha256:eebd356ad7358b7094758e5787a6726f332917cfd56feab6457c56dab895cdbf AS runtime
ENV GC_WORKER_CLAMSCAN_PATH=/usr/local/bin/clamscan
ENV GC_WORKER_CLAMAV_VERSION=1.5.4
ENV CVD_CERTS_DIR=/usr/local/etc/certs
ENV LD_LIBRARY_PATH=/usr/local/lib64:/usr/local/lib
WORKDIR /app

RUN groupadd --gid 10001 genome-companion \
    && useradd --uid 10001 --gid genome-companion --no-create-home --shell /usr/sbin/nologin genome-companion \
    && mkdir --parents /usr/local/share/clamav \
    && chown 10001:10001 /usr/local/share/clamav
COPY --from=clamav /opt/clamav/usr/local/ /usr/local/
COPY --from=build --chown=10001:10001 /workspace/apps/document-worker/build/install/document-worker/ /app/

USER 10001:10001
ENTRYPOINT ["/app/bin/document-worker"]
