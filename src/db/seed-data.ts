// Starting data. Chapter lists follow the FBISE textbooks for classes 9 and 10 —
// the admin can rename, add or remove chapters from the admin panel.

export const SUBJECTS = [
  { slug: 'physics', name: 'Physics', color: '#4f46e5', icon: 'atom', sortOrder: 1 },
  { slug: 'chemistry', name: 'Chemistry', color: '#8b5cf6', icon: 'flask', sortOrder: 2 },
  { slug: 'math', name: 'Mathematics', color: '#0d9488', icon: 'sigma', sortOrder: 3 },
  { slug: 'computer', name: 'Computer Science', color: '#0284c7', icon: 'cpu', sortOrder: 4 },
];

export const CHAPTERS: Record<string, Record<string, string[]>> = {
  physics: {
    '9': ['Physical Quantities and Measurement', 'Kinematics', 'Dynamics-I', 'Turning Effect of Forces', 'Gravitation', 'Work and Energy', 'Density and Temperature', 'Magnetism', 'Transfer of Heat'],
    '10': ['Simple Harmonic Motion and Waves', 'Sound', 'Geometrical Optics', 'Electrostatics', 'Current Electricity', 'Electromagnetism', 'Basic Electronics', 'Information and Communication Technology', 'Atomic and Nuclear Physics'],
  },
  chemistry: {
    '9': ['Fundamentals of Chemistry', 'Structure of Atoms', 'Periodic Table and Periodicity of Properties', 'Structure of Molecules', 'Physical States of Matter', 'Solutions', 'Electrochemistry', 'Chemical Reactivity'],
    '10': ['Chemical Equilibrium', 'Acids, Bases and Salts', 'Organic Chemistry', 'Hydrocarbons', 'Biochemistry', 'The Atmosphere', 'Water', 'Chemical Industries'],
  },
  math: {
    '9': ['Matrices and Determinants', 'Real and Complex Numbers', 'Logarithms', 'Algebraic Expressions and Formulas', 'Factorization', 'Algebraic Manipulation', 'Linear Equations and Inequalities', 'Linear Graphs and Their Application', 'Introduction to Coordinate Geometry'],
    '10': ['Quadratic Equations', 'Theory of Quadratic Equations', 'Variations', 'Partial Fractions', 'Sets and Functions', 'Basic Statistics', 'Introduction to Trigonometry', 'Chords of a Circle', 'Tangent to a Circle'],
  },
  computer: {
    '9': ['Fundamentals of Computer', 'Fundamentals of Operating System', 'Office Automation', 'Data Communication and Computer Networks', 'Computer Security and Ethics', 'Web Development with HTML'],
    '10': ['Introduction to Programming', 'User Interaction', 'Conditional Logic', 'Data and Repetition', 'Functions'],
  },
};

export const TEACHER = {
  name: 'Sir Ahmed Raza',
  title: 'Physics & Mathematics Lecturer · M.Phil (Physics)',
  intro: 'Assalam-o-Alaikum! I have been teaching Federal Board (FBISE) students for over 12 years. My focus is on building strong concepts, not rote learning — every chapter comes with clear notes, short video lectures and topic-wise MCQ tests so you always know where you stand before the board exams.',
  highlights: ['M.Phil Physics', '12+ years teaching', 'FBISE paper pattern expert'],
  years: '12+',
  students: '2,400+',
  results: '96%',
};

type Q = { text: string; options: string[]; correctIndex: number };

const PHYSICS: Q[] = [
  { text: 'Which of the following is a base quantity?', options: ['Speed', 'Force', 'Length', 'Area'], correctIndex: 2 },
  { text: 'The SI unit of mass is:', options: ['gram', 'kilogram', 'pound', 'newton'], correctIndex: 1 },
  { text: '1 nanometre is equal to:', options: ['10⁻³ m', '10⁻⁶ m', '10⁻⁹ m', '10⁻¹² m'], correctIndex: 2 },
  { text: 'The least count of a Vernier callipers is:', options: ['0.1 cm', '0.01 cm', '0.001 cm', '1 mm'], correctIndex: 1 },
  { text: 'The least count of a micrometer screw gauge is:', options: ['0.01 cm', '0.1 mm', '0.001 cm', '0.01 m'], correctIndex: 2 },
  { text: 'Which of these is a derived unit?', options: ['metre', 'kelvin', 'newton', 'ampere'], correctIndex: 2 },
  { text: '0.00045 m written in scientific notation is:', options: ['4.5 × 10⁻⁴ m', '45 × 10⁻⁵ m', '4.5 × 10⁻³ m', '0.45 × 10⁻³ m'], correctIndex: 0 },
  { text: 'How many significant figures are in 0.0060?', options: ['1', '2', '3', '4'], correctIndex: 1 },
  { text: 'The prefix "mega" stands for:', options: ['10³', '10⁶', '10⁹', '10⁻⁶'], correctIndex: 1 },
  { text: 'The volume of an irregular solid can be measured with a:', options: ['Metre rule', 'Measuring cylinder', 'Screw gauge', 'Stopwatch'], correctIndex: 1 },
];

const CHEMISTRY: Q[] = [
  { text: 'The branch of chemistry that deals with carbon compounds is:', options: ['Inorganic chemistry', 'Organic chemistry', 'Physical chemistry', 'Biochemistry'], correctIndex: 1 },
  { text: 'The smallest particle of an element is called:', options: ['Molecule', 'Atom', 'Ion', 'Compound'], correctIndex: 1 },
  { text: 'The atomic number of oxygen is:', options: ['6', '7', '8', '16'], correctIndex: 2 },
  { text: 'The molecular mass of H₂O is:', options: ['16 amu', '17 amu', '18 amu', '20 amu'], correctIndex: 2 },
  { text: "Avogadro's number is:", options: ['6.022 × 10²³', '6.022 × 10²²', '3.0 × 10⁸', '1.6 × 10⁻¹⁹'], correctIndex: 0 },
  { text: 'Which of the following is a compound?', options: ['Oxygen', 'Water', 'Iron', 'Gold'], correctIndex: 1 },
  { text: 'The empirical formula of glucose (C₆H₁₂O₆) is:', options: ['CHO', 'CH₂O', 'C₂H₄O₂', 'C₆H₁₂O₆'], correctIndex: 1 },
  { text: 'The symbol of sodium is:', options: ['S', 'So', 'Na', 'Sd'], correctIndex: 2 },
  { text: 'One mole of any gas at STP occupies:', options: ['11.2 dm³', '22.4 dm³', '24 dm³', '1 dm³'], correctIndex: 1 },
  { text: 'The branch that deals with the analysis of matter is:', options: ['Analytical chemistry', 'Nuclear chemistry', 'Environmental chemistry', 'Industrial chemistry'], correctIndex: 0 },
];

const MATH: Q[] = [
  { text: 'A matrix with 2 rows and 3 columns has order:', options: ['3 × 2', '2 × 3', '2 × 2', '3 × 3'], correctIndex: 1 },
  { text: 'A matrix with only one row is called a:', options: ['Column matrix', 'Row matrix', 'Square matrix', 'Null matrix'], correctIndex: 1 },
  { text: 'The determinant of [[2, 3], [1, 4]] is:', options: ['5', '11', '8', '−5'], correctIndex: 0 },
  { text: 'If |A| = 0, then matrix A is:', options: ['Singular', 'Non-singular', 'Identity', 'Symmetric'], correctIndex: 0 },
  { text: 'The transpose of a row matrix is a:', options: ['Row matrix', 'Column matrix', 'Diagonal matrix', 'Scalar matrix'], correctIndex: 1 },
  { text: 'A + B is defined only when A and B:', options: ['Are square', 'Have the same order', 'Are singular', 'Are identity'], correctIndex: 1 },
  { text: 'The additive inverse of matrix A is:', options: ['A', 'A⁻¹', '−A', 'Aᵗ'], correctIndex: 2 },
  { text: '(AB)ᵗ is equal to:', options: ['AᵗBᵗ', 'BᵗAᵗ', 'AB', 'BA'], correctIndex: 1 },
  { text: 'A square matrix whose non-diagonal entries are all zero is a:', options: ['Diagonal matrix', 'Null matrix', 'Row matrix', 'Rectangular matrix'], correctIndex: 0 },
  { text: 'The multiplicative identity of 2 × 2 matrices is:', options: ['[[0,0],[0,0]]', '[[1,1],[1,1]]', '[[1,0],[0,1]]', '[[0,1],[1,0]]'], correctIndex: 2 },
];

// Demo tests on chapter 1 of class 9 (subject slug → topics)
export const DEMO_ASSESSMENTS: { subject: string; topic: string; questions: Q[] }[] = [
  { subject: 'physics', topic: 'Physical quantities', questions: PHYSICS },
  { subject: 'physics', topic: 'International System of Units (SI)', questions: [...PHYSICS].reverse() },
  { subject: 'physics', topic: 'Measuring instruments', questions: PHYSICS },
  { subject: 'chemistry', topic: 'Branches of chemistry', questions: CHEMISTRY },
  { subject: 'chemistry', topic: 'Atomic and molecular mass', questions: [...CHEMISTRY].reverse() },
  { subject: 'math', topic: 'Types and order of matrices', questions: MATH },
  { subject: 'math', topic: 'Determinant and inverse', questions: [...MATH].reverse() },
];

export const DEMO_VIDEOS = [
  { title: 'Physical quantities: base vs derived', youtubeUrl: 'https://www.youtube.com/results?search_query=physical+quantities+class+9+fbise', duration: '18:42' },
  { title: 'SI units, prefixes and scientific notation', youtubeUrl: 'https://www.youtube.com/results?search_query=si+units+prefixes+class+9', duration: '22:10' },
];

export const DEMO_STUDENTS = [
  { name: 'Ayesha Khan', email: 'ayesha@student.pk', phone: '0300-1234567', classLevel: '9', status: 'approved' as const },
  { name: 'Hamza Ali', email: 'hamza@student.pk', phone: '0321-7654321', classLevel: '10', status: 'approved' as const },
  { name: 'Bilal Ahmed', email: 'bilal@student.pk', phone: '0345-9876543', classLevel: '9', status: 'pending' as const },
  { name: 'Zainab Hussain', email: 'zainab@student.pk', phone: '0312-4567890', classLevel: '10', status: 'pending' as const },
];
export const DEMO_STUDENT_PASSWORD = 'Student@123';
