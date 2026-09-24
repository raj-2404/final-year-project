package com.codeX.live.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LoginRequest {

    // Can be either username or email
    private String username;
    private String email;

    @NotBlank(message = "Password field is required")
    private String password;
}
