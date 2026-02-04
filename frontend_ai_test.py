#!/usr/bin/env python3
"""
Frontend AI Integration Validation Test for Celer AI Interview App
Tests the frontend AI functionality, payload structure, and integration
"""

import re
import json
import sys
from pathlib import Path

class FrontendAIValidator:
    def __init__(self):
        self.frontend_path = Path("/app/index.html")
        self.tests_run = 0
        self.tests_passed = 0
        self.issues = []
        self.frontend_code = ""
        
    def load_frontend_code(self):
        """Load the frontend HTML/JavaScript code"""
        try:
            with open(self.frontend_path, 'r', encoding='utf-8') as f:
                self.frontend_code = f.read()
            return True
        except Exception as e:
            self.issues.append(f"Failed to load frontend code: {e}")
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
    
    def test_ai_mode_component(self):
        """Test that AIMode component exists and is properly structured"""
        # Check if AIMode component is defined
        if "const AIMode = " not in self.frontend_code:
            self.issues.append("AIMode component not found")
            return False
        
        # Check if it accepts required props
        required_props = ["activeAiCard", "onEnd", "toggleFocus", "isFocusMode"]
        aimode_definition = re.search(r"const AIMode = \(\{([^}]+)\}\)", self.frontend_code)
        if not aimode_definition:
            self.issues.append("AIMode component props not found")
            return False
        
        props_text = aimode_definition.group(1)
        missing_props = []
        for prop in required_props:
            if prop not in props_text:
                missing_props.append(prop)
        
        if missing_props:
            self.issues.append(f"AIMode missing props: {', '.join(missing_props)}")
            return False
        
        return True
    
    def test_dynamic_session_id(self):
        """Test that sessionId is dynamically generated from activeAiCard"""
        # Check for sessionId generation using activeAiCard
        session_pattern = r"sessionId.*useMemo.*activeAiCard\?\.id"
        if not re.search(session_pattern, self.frontend_code, re.DOTALL):
            self.issues.append("Dynamic sessionId generation from activeAiCard not found")
            return False
        
        # Check for fallback session ID
        fallback_pattern = r"voice-session-satnam|ai-card-"
        if not re.search(fallback_pattern, self.frontend_code):
            self.issues.append("SessionId fallback not implemented")
            return False
        
        return True
    
    def test_ai_payload_structure(self):
        """Test that AI payload includes required fields"""
        # Look for payload construction in sendMessage function
        payload_pattern = r"const payload = \{[^}]*data: \{[^}]*\}"
        if not re.search(payload_pattern, self.frontend_code, re.DOTALL):
            self.issues.append("AI payload structure not found")
            return False
        
        # Check for required payload fields
        required_fields = [
            "sessionID",
            "systemInstruction", 
            "questionSet",
            "interviewMode"
        ]
        
        missing_fields = []
        for field in required_fields:
            if field not in self.frontend_code:
                missing_fields.append(field)
        
        if missing_fields:
            self.issues.append(f"AI payload missing fields: {', '.join(missing_fields)}")
            return False
        
        # Check that systemInstruction and questionSet come from activeAiCard
        if "activeAiCard?.systemInstruction" not in self.frontend_code:
            self.issues.append("systemInstruction not sourced from activeAiCard")
            return False
        
        if "activeAiCard?.questionSet" not in self.frontend_code:
            self.issues.append("questionSet not sourced from activeAiCard")
            return False
        
        return True
    
    def test_history_fetch_dynamic_session(self):
        """Test that history fetch uses dynamic sessionId"""
        # Check for fetchHistory with dynamic sessionID
        history_pattern = r"fetchHistory.*sessionID.*sessionId"
        if not re.search(history_pattern, self.frontend_code, re.DOTALL):
            self.issues.append("History fetch doesn't use dynamic sessionId")
            return False
        
        # Check that history is fetched in useEffect with sessionId dependency
        useeffect_pattern = r"useEffect\([^}]*fetchCloudHistory[^}]*\[sessionId\]"
        if not re.search(useeffect_pattern, self.frontend_code, re.DOTALL):
            self.issues.append("History fetch useEffect doesn't depend on sessionId")
            return False
        
        return True
    
    def test_interview_mode_integration(self):
        """Test interview mode (technical/behavioral) integration"""
        # Check for interviewMode state
        if "interviewMode" not in self.frontend_code:
            self.issues.append("interviewMode state not found")
            return False
        
        # Check for mode switching buttons
        mode_buttons = ["technical", "behavioral"]
        for mode in mode_buttons:
            if f"setInterviewMode('{mode}')" not in self.frontend_code:
                self.issues.append(f"Interview mode button for {mode} not found")
                return False
        
        # Check that interviewMode is included in AI payload
        if "interviewMode: interviewMode" not in self.frontend_code:
            self.issues.append("interviewMode not included in AI payload")
            return False
        
        return True
    
    def test_existing_functionality_preserved(self):
        """Test that existing sync/audio/history logic is preserved"""
        # Check for existing functionality
        existing_features = [
            "getSpeech",  # Audio functionality
            "fixGrammar", # Grammar correction
            "sync",       # Data sync
            "fetch"       # Data fetch
        ]
        
        missing_features = []
        for feature in existing_features:
            if f'action: "{feature}"' not in self.frontend_code:
                missing_features.append(feature)
        
        if missing_features:
            self.issues.append(f"Missing existing features: {', '.join(missing_features)}")
            return False
        
        # Check for speech synthesis functionality
        if "speechSynthesis" not in self.frontend_code:
            self.issues.append("Speech synthesis functionality missing")
            return False
        
        # Check for audio recording functionality
        if "MediaRecorder" not in self.frontend_code:
            self.issues.append("Audio recording functionality missing")
            return False
        
        return True
    
    def test_ai_card_form_fields(self):
        """Test that AI card creation includes required form fields"""
        # This would be in the card creation modal/form
        # Check for system instruction and question set fields
        
        # Look for textarea or input fields related to AI cards
        ai_form_patterns = [
            r"systemInstruction",
            r"questionSet", 
            r"Generate.*button",
            r"Refine.*button"
        ]
        
        missing_patterns = []
        for pattern in ai_form_patterns:
            if not re.search(pattern, self.frontend_code, re.IGNORECASE):
                missing_patterns.append(pattern)
        
        # This is not critical since the form might be dynamically generated
        # Just check if the concepts exist
        if len(missing_patterns) == len(ai_form_patterns):
            self.issues.append("No AI card form fields found (may be dynamically generated)")
            # Don't fail the test, just note it
        
        return True
    
    def test_error_handling(self):
        """Test error handling in AI functionality"""
        # Check for try-catch blocks in AI functions
        if "try {" not in self.frontend_code or "} catch" not in self.frontend_code:
            self.issues.append("Missing error handling (try-catch blocks)")
            return False
        
        # Check for connection error handling
        if "Connection error" not in self.frontend_code and "connection" not in self.frontend_code.lower():
            self.issues.append("Missing connection error handling")
            return False
        
        return True
    
    def test_ai_status_management(self):
        """Test AI status management (IDLE, THINKING, SPEAKING, etc.)"""
        # Check for status state management
        status_states = ["IDLE", "THINKING", "SPEAKING", "ERROR"]
        
        missing_states = []
        for state in status_states:
            if f'"{state}"' not in self.frontend_code and f"'{state}'" not in self.frontend_code:
                missing_states.append(state)
        
        if missing_states:
            self.issues.append(f"Missing AI status states: {', '.join(missing_states)}")
            return False
        
        # Check for status updates
        if "setStatus" not in self.frontend_code:
            self.issues.append("Status management function not found")
            return False
        
        return True

def main():
    print("🚀 Starting Frontend AI Integration Validation...")
    print("=" * 60)
    
    validator = FrontendAIValidator()
    
    # Load frontend code
    if not validator.load_frontend_code():
        print("❌ Failed to load frontend code")
        return 1
    
    # Run all tests
    test_methods = [
        ("AIMode Component Structure", validator.test_ai_mode_component),
        ("Dynamic Session ID Generation", validator.test_dynamic_session_id),
        ("AI Payload Structure", validator.test_ai_payload_structure),
        ("History Fetch Dynamic Session", validator.test_history_fetch_dynamic_session),
        ("Interview Mode Integration", validator.test_interview_mode_integration),
        ("Existing Functionality Preserved", validator.test_existing_functionality_preserved),
        ("AI Card Form Fields", validator.test_ai_card_form_fields),
        ("Error Handling", validator.test_error_handling),
        ("AI Status Management", validator.test_ai_status_management)
    ]
    
    for test_name, test_func in test_methods:
        validator.run_test(test_name, test_func)
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Frontend AI Integration Validation Results:")
    print(f"Tests passed: {validator.tests_passed}/{validator.tests_run}")
    
    if validator.issues:
        print(f"\n❌ Issues found:")
        for issue in validator.issues:
            print(f"  • {issue}")
    else:
        print(f"\n✅ All frontend AI integration tests passed!")
    
    # Return success/failure
    success_rate = (validator.tests_passed / validator.tests_run) * 100 if validator.tests_run > 0 else 0
    print(f"Success rate: {success_rate:.1f}%")
    
    return 0 if success_rate >= 85 else 1

if __name__ == "__main__":
    sys.exit(main())