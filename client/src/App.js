import React, { useState, useEffect } from 'react';
import './App.css'; // Import the CSS file

function App() {
  const [inputValue, setInputValue] = useState(''); // State to store the input value (question)
  const [questionsAnswers, setQuestionsAnswers] = useState([]); // State to store all questions and answers

  // Load saved questions and answers from localStorage when the component mounts
  useEffect(() => {
    const savedData = JSON.parse(localStorage.getItem('questionsAnswers')) || [];
    setQuestionsAnswers(savedData);
  }, []);

  // Handle text input changes
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault(); // Prevent default form submission behavior

    // Example mock answer for now (replace with actual API call in future)
    const mockAnswer = `This is a mock answer to your question: "${inputValue}"`;

    // Create the new question-answer pair
    const newQuestionAnswer = { question: inputValue, answer: mockAnswer };

    // Add the new question-answer pair to the state and localStorage
    const updatedQuestionsAnswers = [...questionsAnswers, newQuestionAnswer];
    setQuestionsAnswers(updatedQuestionsAnswers);

    // Save updated questions and answers to localStorage
    localStorage.setItem('questionsAnswers', JSON.stringify(updatedQuestionsAnswers));

    setInputValue(''); // Clear the input field after submission
  };

  return (
    <div className="container">
      <h1>Ask a Question</h1>

      {/* Form with text input and submit button */}
      <form onSubmit={handleSubmit}>
        <div>
          <input
            type="text"
            id="textInput"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Type your question here"
          />
        </div>
        <button type="submit">Submit</button>
      </form>

      {/* Display all submitted questions and answers */}
      <div className="questions-answers">
        {questionsAnswers.map((qa, index) => (
          <div key={index} className="qa-pair">
            <div className="question">{qa.question}</div>
            <div className="answer">{qa.answer}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
