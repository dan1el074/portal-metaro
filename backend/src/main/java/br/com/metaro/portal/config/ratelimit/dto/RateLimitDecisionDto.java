package br.com.metaro.portal.config.ratelimit.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class RateLimitDecisionDto {
    private boolean allowed;
    private long remainingTokens;
    private long retryAfterNanos;
}
