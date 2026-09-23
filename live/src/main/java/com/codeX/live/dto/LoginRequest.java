package com.codeX.live.dto;

import jakarta.validation.constraints.Email;
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

    @NotBlank(message = "Email field is required")
    @Email(message = "Email is Invalid")
    private String email;

    @NotBlank(message = "Password field is required")
    private String password;
}
