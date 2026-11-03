// Android shell-UID probe: schedule and sample on the device, independently of host load.
// Build with the NDK's aarch64-linux-android24-clang. No app hooks or root required.
#define _POSIX_C_SOURCE 200809L
#include <errno.h>
#include <inttypes.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

static int64_t now_ns(void) {
    struct timespec t;
    if (clock_gettime(CLOCK_MONOTONIC, &t)) { perror("clock_gettime"); exit(2); }
    return (int64_t)t.tv_sec * 1000000000 + t.tv_nsec;
}

static void sleep_until(int64_t deadline) {
    struct timespec t = { deadline / 1000000000, deadline % 1000000000 };
    int result;
    while ((result = clock_nanosleep(CLOCK_MONOTONIC, TIMER_ABSTIME, &t, NULL)) == EINTR) {}
    if (result) { fprintf(stderr, "clock_nanosleep: %d\n", result); exit(2); }
}

static void process_stat(const char *pid, const char *label) {
    char path[128], line[4096];
    snprintf(path, sizeof(path), "/proc/%s/stat", pid);
    FILE *f = fopen(path, "r");
    if (!f || !fgets(line, sizeof(line), f)) { perror("process stat"); exit(2); }
    fclose(f);
    printf("STAT\t%s\t%" PRId64 "\t%s", label, now_ns(), line);
}

static pid_t tap(const char *x, const char *y) {
    pid_t child = fork();
    if (child < 0) { perror("fork input"); exit(2); }
    if (child == 0) {
        // Android 8 ships input as a shell script without an executable shebang.
        execl("/system/bin/sh", "sh", "/system/bin/input", "tap", x, y, (char *)NULL);
        perror("exec input"); _exit(127);
    }
    return child;
}

static void poll_surface(const char *layer, int sample) {
    int pipes[2];
    if (pipe(pipes)) { perror("pipe"); exit(2); }
    int64_t before = now_ns();
    pid_t child = fork();
    if (child < 0) { perror("fork dumpsys"); exit(2); }
    if (child == 0) {
        close(pipes[0]);
        if (dup2(pipes[1], STDOUT_FILENO) < 0) _exit(127);
        close(pipes[1]);
        execl("/system/bin/dumpsys", "dumpsys", "SurfaceFlinger", "--latency", layer, (char *)NULL);
        perror("exec dumpsys"); _exit(127);
    }
    close(pipes[1]);
    FILE *stream = fdopen(pipes[0], "r");
    if (!stream) { perror("fdopen"); exit(2); }
    char line[512];
    printf("POLL\t%d\t%" PRId64 "\n", sample, before);
    while (fgets(line, sizeof(line), stream)) printf("FENCE\t%d\t%s", sample, line);
    fclose(stream);
    int status;
    if (waitpid(child, &status, 0) != child || !WIFEXITED(status) || WEXITSTATUS(status)) {
        fprintf(stderr, "SurfaceFlinger dump failed\n"); exit(2);
    }
    printf("POLL_END\t%d\t%" PRId64 "\n", sample, now_ns());
}

int main(int argc, char **argv) {
    if (argc != 6) {
        fprintf(stderr, "usage: probe PID LAYER SECONDS TAP_X TAP_Y\n"); return 2;
    }
    for (const char *p = argv[1]; *p; p++) if (*p < '0' || *p > '9') return 2;
    int seconds = atoi(argv[3]);
    if (seconds < 6 || seconds > 120 || !*argv[1]) return 2;
    long ticks = sysconf(_SC_CLK_TCK);
    if (ticks <= 0) return 2;
    setvbuf(stdout, NULL, _IOLBF, 0);
    printf("CLOCK_TICKS\t%ld\n", ticks);
    process_stat(argv[1], "before");
    int64_t start = now_ns(), duration = (int64_t)seconds * 1000000000;
    printf("WINDOW_START\t%" PRId64 "\n", start);
    pid_t taps[3] = {0};
    int action = 0;
    for (int sample = 0; ; sample++) {
        int64_t due = start + (int64_t)sample * 500000000;
        if (due >= start + duration) break;
        sleep_until(due);
        if (action < 3 && now_ns() >= start + duration * (1 + 2 * action) / 6) {
            printf("INPUT_START\t%d\t%" PRId64 "\n", action, now_ns());
            taps[action] = tap(argv[4], argv[5]);
            action++;
        }
        poll_surface(argv[2], sample);
    }
    sleep_until(start + duration);
    printf("WINDOW_END\t%" PRId64 "\n", now_ns());
    process_stat(argv[1], "after");
    // Resolve fences submitted near the boundary; analysis filters actual presentation by window.
    sleep_until(start + duration + 100000000);
    poll_surface(argv[2], seconds * 2);
    if (action != 3) { fprintf(stderr, "Missed scheduled input\n"); return 2; }
    for (int i = 0; i < 3; i++) {
        int status;
        if (waitpid(taps[i], &status, 0) != taps[i] || !WIFEXITED(status) || WEXITSTATUS(status)) {
            fprintf(stderr, "Input failed\n"); return 2;
        }
    }
    return 0;
}
