'use client'

import { useState, useCallback, useEffect } from 'react'

const ACCESS_CODE = 'FINCENTIVA2026'

// Skills disponibles
const SKILLS = [
  {
    id: 'pdf-to-excel',
    name: 'PDF → Excel',
    icon: '📄',
    description: 'Extrae tablas de un PDF (estado de cuenta, facturas) y genera un Excel/CSV descargable',
    category: 'Documentos',
    acceptedFiles: '.pdf,.txt,.csv',
    placeholder: 'Ejemplo: "Extrae todas las transacciones de este estado de cuenta bancario"',
    tested: true,
  },
  {
    id: 'invoice-organizer',
    name: 'Organizador de Facturas',
    icon: '🧾',
    description: 'Organiza facturas y recibos automáticamente para preparación de impuestos',
    category: 'Finanzas',
    acceptedFiles: '.pdf,.jpg,.png,.txt',
    placeholder: 'Ejemplo: "Organiza estas facturas por fecha y calcula el total de IVA"',
    tested: false,
  },
  {
    id: 'file-organizer',
    name: 'Organizador de Archivos',
    icon: '📁',
    description: 'Sugiere cómo organizar tus archivos y carpetas de forma inteligente',
    category: 'Productividad',
    acceptedFiles: '*',
    placeholder: 'Describe la estructura actual de tus archivos o pega una lista...',
    tested: false,
  },
  {
    id: 'changelog-generator',
    name: 'Generador de Changelog',
    icon: '📝',
    description: 'Genera notas de versión profesionales a partir de commits de Git',
    category: 'Desarrollo',
    acceptedFiles: '.txt,.md',
    placeholder: 'Pega tus commits de Git aquí o describe los cambios...',
    tested: false,
  },
  {
    id: 'meeting-analyzer',
    name: 'Analizador de Reuniones',
    icon: '🎯',
    description: 'Analiza transcripciones de reuniones y extrae insights y action items',
    category: 'Productividad',
    acceptedFiles: '.txt,.md,.vtt,.srt',
    placeholder: 'Pega la transcripción de tu reunión aquí...',
    tested: false,
  },
  {
    id: 'content-writer',
    name: 'Escritor de Contenido',
    icon: '✍️',
    description: 'Ayuda a escribir contenido con investigación, citas y feedback',
    category: 'Marketing',
    acceptedFiles: '.txt,.md,.docx',
    placeholder: 'Describe el tema sobre el que quieres escribir...',
    tested: false,
  },
]

interface SkillResult {
  result: string
  csv?: string
  csvFileName?: string
  jsonData?: Record<string, unknown>
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [accessCode, setAccessCode] = useState('')
  const [codeError, setCodeError] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [selectedSkill, setSelectedSkill] = useState<typeof SKILLS[0] | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [userInput, setUserInput] = useState('')
  const [result, setResult] = useState<SkillResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Verificar si ya está autenticado (localStorage)
  useEffect(() => {
    const saved = localStorage.getItem('skill_runner_auth')
    if (saved === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  const handleLogin = () => {
    if (accessCode.toUpperCase() === ACCESS_CODE) {
      setIsAuthenticated(true)
      localStorage.setItem('skill_runner_auth', 'true')
      setCodeError(false)
    } else {
      setCodeError(true)
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem('skill_runner_auth')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const downloadCSV = () => {
    if (!result?.csv || !result?.csvFileName) return
    
    const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = result.csvFileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const downloadExcel = () => {
    if (!result?.csv || !result?.csvFileName) return
    
    // Para un Excel real, usaríamos una librería como xlsx
    // Por ahora, descargamos CSV que Excel puede abrir
    const blob = new Blob(['\ufeff' + result.csv], { type: 'application/vnd.ms-excel;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = result.csvFileName.replace('.csv', '.xls')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const executeSkill = async () => {
    if (!selectedSkill) return
    
    setIsLoading(true)
    setResult(null)
    
    try {
      const formData = new FormData()
      formData.append('skillId', selectedSkill.id)
      formData.append('userInput', userInput)
      if (file) {
        formData.append('file', file)
      }
      
      const response = await fetch('/api/execute-skill', {
        method: 'POST',
        body: formData,
      })
      
      const data = await response.json()
      
      if (data.error) {
        setResult({ result: `Error: ${data.error}` })
      } else {
        setResult(data)
      }
    } catch (error) {
      setResult({ result: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}` })
    } finally {
      setIsLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // Pantalla de login
  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-logo">🔐</div>
          <h1>Skill Runner</h1>
          <p>Ingresa el código de acceso</p>
          
          <div className="login-form">
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={accessCode}
                onChange={(e) => {
                  setAccessCode(e.target.value)
                  setCodeError(false)
                }}
                onKeyPress={handleKeyPress}
                placeholder="Código de acceso"
                className={codeError ? 'error' : ''}
                autoFocus
              />
              <button 
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Ocultar código' : 'Mostrar código'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {codeError && (
              <span className="error-message">Código incorrecto</span>
            )}
            <button onClick={handleLogin} className="login-btn">
              Entrar
            </button>
          </div>
          
          <p className="login-footer">
            Powered by Claude AI
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <header className="header">
        <h1>⚡ Skill Runner</h1>
        <p>Selecciona un skill y ejecuta tareas con Claude AI</p>
        <button className="logout-btn" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </header>

      <div className="skills-grid">
        {SKILLS.map((skill) => (
          <div
            key={skill.id}
            className={`skill-card ${selectedSkill?.id === skill.id ? 'selected' : ''}`}
            onClick={() => {
              setSelectedSkill(skill)
              setFile(null)
              setUserInput('')
              setResult(null)
            }}
          >
            {skill.tested && (
              <div className="tested-badge" title="Skill testeado y funcionando">
                ✓
              </div>
            )}
            <div className="skill-icon">{skill.icon}</div>
            <h3>{skill.name}</h3>
            <p>{skill.description}</p>
            <span className="skill-category">{skill.category}</span>
          </div>
        ))}
      </div>

      {selectedSkill && (
        <div className="execution-panel">
          <h2>
            {selectedSkill.icon} {selectedSkill.name}
          </h2>

          <div
            className={`dropzone ${file ? 'active' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept={selectedSkill.acceptedFiles}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <div className="dropzone-icon">📎</div>
            <p>
              <strong>Arrastra un archivo aquí</strong> o haz clic para seleccionar
            </p>
            <p style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              Acepta: {selectedSkill.acceptedFiles}
            </p>
          </div>

          {file && (
            <div className="file-preview">
              <span className="file-icon">📄</span>
              <div className="file-info">
                <div className="file-name">{file.name}</div>
                <div className="file-size">{formatFileSize(file.size)}</div>
              </div>
              <button 
                className="remove-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setFile(null)
                }}
              >
                ✕
              </button>
            </div>
          )}

          <div className="input-area">
            <label>Instrucciones adicionales (opcional)</label>
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder={selectedSkill.placeholder}
            />
          </div>

          <button
            className="execute-btn"
            onClick={executeSkill}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Procesando...
              </>
            ) : (
              <>
                ⚡ Ejecutar Skill
              </>
            )}
          </button>

          {(result || isLoading) && (
            <div className="result-panel">
              <h3>📋 Resultado</h3>
              {isLoading ? (
                <div className="loading">
                  <div className="spinner"></div>
                  <span>Claude está procesando tu solicitud...</span>
                </div>
              ) : (
                <>
                  {/* Botones de descarga si hay CSV */}
                  {result?.csv && (
                    <div className="download-buttons">
                      <button className="download-btn excel" onClick={downloadExcel}>
                        📊 Descargar Excel (.xls)
                      </button>
                      <button className="download-btn csv" onClick={downloadCSV}>
                        📄 Descargar CSV
                      </button>
                    </div>
                  )}
                  
                  {/* Preview del CSV */}
                  {result?.csv && (
                    <div className="csv-preview">
                      <h4>Vista previa de datos:</h4>
                      <div className="csv-table">
                        <table>
                          <tbody>
                            {result.csv.split('\n').slice(0, 10).map((row, i) => (
                              <tr key={i}>
                                {row.split(',').map((cell, j) => (
                                  <td key={j}>{cell.replace(/"/g, '')}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {result.csv.split('\n').length > 10 && (
                          <p className="more-rows">... y {result.csv.split('\n').length - 10} filas más</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Respuesta de texto */}
                  {!result?.csv && (
                    <div className="result-content">{result?.result}</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
