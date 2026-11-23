package br.com.metaro.portal.integration.bunny.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class BunnyCredentialsDto {
    private String libraryId;
    private String apiKey;
}
