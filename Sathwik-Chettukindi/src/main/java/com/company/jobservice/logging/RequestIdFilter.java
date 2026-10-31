package com.company.jobservice.logging;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Runs before every other filter (including Spring Security). Accepts X-Request-Id only if
 * it matches [A-Za-z0-9_-]{1,64}; otherwise generates a UUID. The id is put in MDC, stored
 * as a request attribute and returned in the response header. MDC is always cleared.
 *
 * Logs one line per request with method, path (no query string), status and duration.
 * Headers and bodies are never logged.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Request-Id";
    public static final String ATTRIBUTE = "requestId";
    public static final String MDC_KEY = "requestId";
    private static final Pattern VALID = Pattern.compile("[A-Za-z0-9_-]{1,64}");
    private static final Logger log = LoggerFactory.getLogger(RequestIdFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String requestId = resolve(request.getHeader(HEADER));
        request.setAttribute(ATTRIBUTE, requestId);
        response.setHeader(HEADER, requestId);
        MDC.put(MDC_KEY, requestId);
        long start = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            try {
                log.info("Request completed: method={} path={} status={} durationMs={}",
                        request.getMethod(), request.getRequestURI(), response.getStatus(),
                        (System.nanoTime() - start) / 1_000_000);
            } finally {
                MDC.clear();
            }
        }
    }

    public static String resolve(String header) {
        return header != null && VALID.matcher(header).matches() ? header : UUID.randomUUID().toString();
    }

    public static String current(HttpServletRequest request) {
        Object value = request.getAttribute(ATTRIBUTE);
        return value != null ? value.toString() : MDC.get(MDC_KEY);
    }
}
