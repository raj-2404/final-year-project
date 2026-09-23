package com.codeX.live.service;

import com.codeX.live.dto.AuthResponse;
import com.codeX.live.dto.LoginRequest;
import com.codeX.live.dto.RegisterRequest;
import com.codeX.live.dto.UserDto;
import com.codeX.live.entity.User;
import com.codeX.live.repository.UserRepository;
import com.codeX.live.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    @Transactional
    public ResponseEntity<?> register(RegisterRequest request) {
        Map<String, String> errors = new HashMap<>();

        if (request.getName() == null || request.getName().trim().isEmpty()) {
            errors.put("name", "Name field required");
        }

        if (request.getEmail() == null || request.getEmail().trim().isEmpty()) {
            errors.put("email", "Email field is required");
        }

        if (request.getPassword() == null || request.getPassword().trim().isEmpty()) {
            errors.put("password", "Password field is required");
        } else if (request.getPassword().length() < 8 || request.getPassword().length() > 30) {
            errors.put("password", "Password must be atleast 8 character");
        }

        if (request.getPassword2() == null || request.getPassword2().trim().isEmpty()) {
            errors.put("password2", "Confirm password field is required");
        } else if (request.getPassword() != null && !request.getPassword().equals(request.getPassword2())) {
            errors.put("password2", "Password must match");
        }

        if (!errors.isEmpty()) {
            return ResponseEntity.badRequest().body(errors);
        }

        if (userRepository.existsByEmail(request.getEmail().trim().toLowerCase())) {
            errors.put("email", "Email already exists");
            return ResponseEntity.badRequest().body(errors);
        }

        User user = User.builder()
                .name(request.getName().trim())
                .email(request.getEmail().trim().toLowerCase())
                .password(passwordEncoder.encode(request.getPassword()))
                .build();

        User savedUser = userRepository.save(user);

        UserDto userDto = UserDto.builder()
                .id(savedUser.getId())
                .name(savedUser.getName())
                .email(savedUser.getEmail())
                .createdAt(savedUser.getCreatedAt())
                .build();

        return ResponseEntity.ok(userDto);
    }

    public ResponseEntity<?> login(LoginRequest request) {
        Map<String, String> errors = new HashMap<>();

        if (request.getEmail() == null || request.getEmail().trim().isEmpty()) {
            errors.put("email", "Email field is required");
        }

        if (request.getPassword() == null || request.getPassword().trim().isEmpty()) {
            errors.put("password", "Password field is required");
        }

        if (!errors.isEmpty()) {
            return ResponseEntity.badRequest().body(errors);
        }

        Optional<User> optionalUser = userRepository.findByEmail(request.getEmail().trim().toLowerCase());
        if (optionalUser.isEmpty()) {
            errors.put("emailNotFound", "Email Not Found");
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(errors);
        }

        User user = optionalUser.get();

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            errors.put("passwordIncorrect", "Password Incorrect");
            return ResponseEntity.badRequest().body(errors);
        }

        String token = jwtTokenProvider.generateToken(user);

        AuthResponse response = AuthResponse.builder()
                .success(true)
                .token(token)
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .build();

        return ResponseEntity.ok(response);
    }

    public ResponseEntity<?> getCurrentUser(String email) {
        return userRepository.findByEmail(email)
                .map(user -> ResponseEntity.ok(
                        UserDto.builder()
                                .id(user.getId())
                                .name(user.getName())
                                .email(user.getEmail())
                                .createdAt(user.getCreatedAt())
                                .build()
                ))
                .orElse(ResponseEntity.status(HttpStatus.NOT_FOUND).build());
    }
}
