#!/usr/bin/env python3
"""
Backend Code Validation Test for Celer AI Interview App
Tests the Firebase function logic, endpoints, and configuration
"""

import re
import json
import sys
from pathlib import Path

class FirebaseBackendValidator:
    def __init__(self):
        self.backend_path = Path("/app/backend/index.js")
        self.tests_run = 0
        self.tests_passed = 0
        self.issues = []
        self.backend_code = ""
        
    def load_backend_code(self):
        """Load the backend Firebase function code"""
        try:
            with open(self.backend_path, 'r', encoding='utf-8') as f:
                self.backend_code = f.read()
            return True
        except Exception as e:
            self.issues.append(f"Failed to load backend code: {e}")
            return False
    
    def run_test(self, test_name, test_func):
        """Run a single test and track results"""
        self.tests_run += 1
        print(f"\n🔍 Testing {test_name}...")
        
        try:
            success = test_func()
            if success:
                self.tests_passed += 1
                print(f"✅ Passed")
                return True
            else:
                print(f"❌ Failed")
                return False
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.issues.append(f"{test_name}: {str(e)}")
            return False
    
    def test_ai_generate_endpoint(self):
        """Test /api/ai/generate endpoint implementation"""
        # Check if the endpoint exists
        generate_pattern = r"path\.startsWith\(['\"]\/api\/ai\/generate['\"]"
        if not re.search(generate_pattern, self.backend_code):
            self.issues.append("Missing /api/ai/generate endpoint")
            return False
        
        # Check if it returns system_instruction and question_set
        return_pattern = r"system_instruction.*question_set"
        if not re.search(return_pattern, self.backend_code, re.DOTALL):
            self.issues.append("/api/ai/generate doesn't return expected fields")
            return False
        
        # Check if it uses buildInstructionPrompt
        if "buildInstructionPrompt" not in self.backend_code:
            self.issues.append("Missing buildInstructionPrompt function")
            return False
        
        return True
    
    def test_ai_refine_endpoint(self):
        """Test /api/ai/refine endpoint implementation"""
        # Check if the endpoint exists
        refine_pattern = r"path\.startsWith\(['\"]\/api\/ai\/refine['\"]"
        if not re.search(refine_pattern, self.backend_code):
            self.issues.append("Missing /api/ai/refine endpoint")
            return False
        
        # Check if it uses buildRefinePrompt
        if "buildRefinePrompt" not in self.backend_code:
            self.issues.append("Missing buildRefinePrompt function")
            return False
        
        # Check if it accepts systemInstruction parameter
        if "requestData.systemInstruction" not in self.backend_code:
            self.issues.append("/api/ai/refine doesn't accept systemInstruction parameter")
            return False
        
        return True
    
    def test_gemini_configuration(self):
        """Test GEMINI API configuration and fallback"""
        # Check GEMINI_MODEL configuration
        model_pattern = r"GEMINI_MODEL\s*=\s*process\.env\.GEMINI_MODEL\s*\|\|\s*['\"]gemini-flash-3['\"]"
        if not re.search(model_pattern, self.backend_code):
            self.issues.append("GEMINI_MODEL configuration incorrect")
            return False
        
        # Check GEMINI_API_KEY with EMERGENT_LLM_KEY fallback
        key_pattern = r"GEMINI_API_KEY\s*=\s*process\.env\.GEMINI_API_KEY\s*\|\|\s*process\.env\.EMERGENT_LLM_KEY"
        if not re.search(key_pattern, self.backend_code):
            self.issues.append("GEMINI_API_KEY fallback to EMERGENT_LLM_KEY not configured")
            return False
        
        # Check getGeminiClient function
        if "getGeminiClient" not in self.backend_code:
            self.issues.append("Missing getGeminiClient function")
            return False
        
        return True
    
    def test_existing_endpoints(self):
        """Test that existing endpoints are preserved"""
        required_endpoints = [
            "sync",
            "fetch", 
            "fetchHistory",
            "getSpeech",
            "fixGrammar"
        ]
        
        missing_endpoints = []
        for endpoint in required_endpoints:
            if f'action === "{endpoint}"' not in self.backend_code:
                missing_endpoints.append(endpoint)
        
        if missing_endpoints:
            self.issues.append(f"Missing existing endpoints: {', '.join(missing_endpoints)}")
            return False
        
        return True
    
    def test_history_dynamic_session(self):
        """Test that fetchHistory uses dynamic sessionID"""
        # Check if fetchHistory uses requestData.sessionID
        session_pattern = r"requestData\.sessionID\s*\|\|\s*['\"]anon['\"]"
        if not re.search(session_pattern, self.backend_code):
            self.issues.append("fetchHistory doesn't use dynamic sessionID")
            return False
        
        return True
    
    def test_ai_mode_integration(self):
        """Test AI mode integration with system instruction and question set"""
        # Check if systemInstruction is used in AI processing
        if "requestData.systemInstruction" not in self.backend_code:
            self.issues.append("AI mode doesn't accept systemInstruction")
            return False
        
        # Check if questionSet is used
        if "requestData.questionSet" not in self.backend_code:
            self.issues.append("AI mode doesn't accept questionSet")
            return False
        
        return True
    
    def test_function_exports(self):
        """Test that the Firebase function is properly exported"""
        export_pattern = r"exports\.interviewAgent\s*=\s*onRequest"
        if not re.search(export_pattern, self.backend_code):
            self.issues.append("Firebase function not properly exported")
            return False
        
        return True
    
    def test_cors_configuration(self):
        """Test CORS configuration for frontend integration"""
        cors_patterns = [
            r"Access-Control-Allow-Origin",
            r"Access-Control-Allow-Methods", 
            r"Access-Control-Allow-Headers"
        ]
        
        for pattern in cors_patterns:
            if not re.search(pattern, self.backend_code):
                self.issues.append(f"Missing CORS header: {pattern}")
                return False
        
        return True
    
    def test_error_handling(self):
        """Test error handling in endpoints"""
        # Check for try-catch blocks
        if "try {" not in self.backend_code or "} catch" not in self.backend_code:
            self.issues.append("Missing error handling (try-catch blocks)")
            return False
        
        # Check for error responses
        if "res.status(500)" not in self.backend_code:
            self.issues.append("Missing error response handling")
            return False
        
        return True

def main():
    print("🚀 Starting Firebase Backend Code Validation...")
    print("=" * 60)
    
    validator = FirebaseBackendValidator()
    
    # Load backend code
    if not validator.load_backend_code():
        print("❌ Failed to load backend code")
        return 1
    
    # Run all tests
    test_methods = [
        ("AI Generate Endpoint", validator.test_ai_generate_endpoint),
        ("AI Refine Endpoint", validator.test_ai_refine_endpoint),
        ("GEMINI Configuration", validator.test_gemini_configuration),
        ("Existing Endpoints Preserved", validator.test_existing_endpoints),
        ("Dynamic Session History", validator.test_history_dynamic_session),
        ("AI Mode Integration", validator.test_ai_mode_integration),
        ("Function Exports", validator.test_function_exports),
        ("CORS Configuration", validator.test_cors_configuration),
        ("Error Handling", validator.test_error_handling)
    ]
    
    for test_name, test_func in test_methods:
        validator.run_test(test_name, test_func)
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Backend Code Validation Results:")
    print(f"Tests passed: {validator.tests_passed}/{validator.tests_run}")
    
    if validator.issues:
        print(f"\n❌ Issues found:")
        for issue in validator.issues:
            print(f"  • {issue}")
    else:
        print(f"\n✅ All backend code validation tests passed!")
    
    # Return success/failure
    success_rate = (validator.tests_passed / validator.tests_run) * 100 if validator.tests_run > 0 else 0
    print(f"Success rate: {success_rate:.1f}%")
    
    return 0 if success_rate >= 90 else 1

if __name__ == "__main__":
    sys.exit(main())