"""
Quick setup script to run the CodeTide with sample data
"""
import os
import sys
import subprocess

def setup_and_run():
    """Setup sample data and provide instructions to run the application"""
    
    print("🚀 CodeTide - Quick Setup")
    print("=" * 50)
    
    # Change to backend directory and create sample data
    backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
    os.chdir(backend_dir)
    
    print("📊 Creating sample data...")
    try:
        from backend import sample_data
        sample_data.create_sample_data()
        print("✅ Sample data created successfully!")
    except Exception as e:
        print(f"❌ Error creating sample data: {e}")
        return
    
    print("\n🎯 Setup Complete!")
    print("\nTo run the application:")
    print("\n1. Start the backend server:")
    print("   cd backend")
    print("   pip install -r requirements.txt")
    print("   python app.py")
    
    print("\n2. In a new terminal, start the frontend:")
    print("   cd frontend")
    print("   npm install")
    print("   npm start")
    
    print("\n3. Open http://localhost:3000 in your browser")
    
    print("\n📝 Sample data includes:")
    print("   - 6 contributors (developers & testers)")
    print("   - 90 days of commit history")
    print("   - Multiple teams and commit types")
    print("   - Realistic file changes and metrics")
    
    print("\n🔧 To add your own repository:")
    print("   1. Go to the Repositories tab")
    print("   2. Click 'Add Repository'")
    print("   3. Enter the path to your git repository")
    print("   4. Click 'Analyze' to process commits")

if __name__ == "__main__":
    setup_and_run()
