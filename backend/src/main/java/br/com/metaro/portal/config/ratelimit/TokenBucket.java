package br.com.metaro.portal.config.ratelimit;

import br.com.metaro.portal.config.ratelimit.dto.RateLimitDecisionDto;

final class TokenBucket {
    private double tokens;
    private long lastRefillNanos;

    TokenBucket(long capacity, long now) {
        this.tokens = capacity;
        this.lastRefillNanos = now;
    }

    synchronized RateLimitDecisionDto consume(long now, long capacity, long refillPeriodNanos) {
        long elapsed = Math.max(0, now - lastRefillNanos);
        tokens = Math.min(capacity, tokens + ((double) elapsed * capacity / refillPeriodNanos));
        lastRefillNanos = now;

        if (tokens >= 1) {
            tokens -= 1;
            return new RateLimitDecisionDto(true, (long) Math.floor(tokens), 0);
        }

        long retryAfterNanos = (long) Math.ceil((1 - tokens) * refillPeriodNanos / capacity);
        return new RateLimitDecisionDto(false, 0, retryAfterNanos);
    }
}
