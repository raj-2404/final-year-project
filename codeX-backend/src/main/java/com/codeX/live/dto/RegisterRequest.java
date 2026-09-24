package com.codeX.live.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RegisterRequest {

    @NotBlank(message = "Username is required")
    @Size(min = 3, max = 30, message = "Username must be between 3 and 30 characters")
    @Pattern(regexp = "^[a-zA-Z0-9_.]+$", message = "Username can only contain letters, numbers, underscores, and dots")
    private String username;

    private String name;

    @NotBlank(message = "Email field is required")
    @Email(message = "Email is Invalid")
    private String email;

    @NotBlank(message = "Password field is required")
    @Size(min = 8, max = 30, message = "Password must be atleast 8 character")
    private String password;

    @NotBlank(message = "Confirm password field is required")
    private String password2;
}
