type Props = {
  className?: string;
  style?: React.CSSProperties;
};

export default function ExampleAdvertPlaceholder({ className, style }: Props) {
  return (
    <div
      className={className}
      style={{
        background: '#2a2f3e',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        gap: '8px',
        ...style,
      }}
    >
      <svg version="1.0" viewBox="0 0 64 64" style={{ width: '52%', height: 'auto' }} xmlns="http://www.w3.org/2000/svg">
        <g>
          <g>
            <path fill="#2563EB" d="M27,8h10c17.495,0,18,21.544,18,24h2c0-2.661-0.533-26-19-26H26C18.904,6,7,9.378,7,32h2C9,16.523,15.393,8,27,8z"/>
            <path fill="#2563EB" d="M58,34H6c-2.206,0-4,1.794-4,4v10c0,2.206,1.794,4,4,4h52c2.206,0,4-1.794,4-4V38C62,35.794,60.206,34,58,34z"/>
          </g>
          <g>
            <path fill="#e8f0fe" d="M50.581,19.394C47.909,13.16,43.34,10,37,10H27c-7.299,0-16,3.816-16,22h5c0-4.418,3.582-8,8-8s8,3.582,8,8h21C53,30.367,52.825,24.632,50.581,19.394z"/>
            <path fill="#e8f0fe" d="M24,26c-3.313,0-6,2.687-6,6h12C30,28.687,27.313,26,24,26z"/>
          </g>
          <g>
            <path fill="#cccccc" d="M24,24c-4.418,0-8,3.582-8,8h-5c0-18.184,8.701-22,16-22h10c6.34,0,10.909,3.16,13.581,9.394C52.825,24.632,53,30.367,53,32H32C32,27.582,28.418,24,24,24z"/>
            <path fill="#cccccc" d="M30,32H18c0-3.313,2.687-6,6-6S30,28.687,30,32z"/>
            <path fill="#cccccc" d="M11,39c-2.206,0-4,1.794-4,4s1.794,4,4,4s4-1.794,4-4S13.206,39,11,39z M11,45c-1.103,0-2-0.897-2-2s0.897-2,2-2s2,0.897,2,2S12.103,45,11,45z"/>
            <path fill="#cccccc" d="M53,39c-2.206,0-4,1.794-4,4s1.794,4,4,4s4-1.794,4-4S55.206,39,53,39z M53,45c-1.103,0-2-0.897-2-2s0.897-2,2-2s2,0.897,2,2S54.103,45,53,45z"/>
            <path fill="#cccccc" d="M43,40H21c-0.553,0-1,0.447-1,1s0.447,1,1,1h22c0.553,0,1-0.447,1-1S43.553,40,43,40z"/>
            <path fill="#cccccc" d="M43,44H21c-0.553,0-1,0.447-1,1s0.447,1,1,1h22c0.553,0,1-0.447,1-1S43.553,44,43,44z"/>
            <path fill="#cccccc" d="M43.293,18.708c0.195,0.195,0.451,0.293,0.707,0.293s0.512-0.098,0.707-0.293c0.391-0.391,0.391-1.023,0-1.414l-2-2c-0.391-0.391-1.023-0.391-1.414,0s-0.391,1.023,0,1.414L43.293,18.708z"/>
            <path fill="#cccccc" d="M43.293,23.707C43.488,23.902,43.744,24,44,24s0.512-0.098,0.707-0.293c0.391-0.391,0.391-1.023,0-1.414l-7-7c-0.391-0.391-1.023-0.391-1.414,0s-0.391,1.023,0,1.414L43.293,23.707z"/>
          </g>
<g>
            <circle fill="#e8f0fe" cx="11" cy="43" r="2"/>
            <circle fill="#e8f0fe" cx="53" cy="43" r="2"/>
          </g>
        </g>
      </svg>
      <div style={{ textAlign: 'center', lineHeight: 1.3 }}>
        <span style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', fontSize: '14px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.2px' }}>
          Owner<span style={{ color: '#2563EB' }}>Cars</span><span style={{ color: '#2563EB', fontWeight: 400, fontSize: '11px' }}>.co.uk</span>
        </span>
        <br/>
        <span style={{ fontFamily: '-apple-system, sans-serif', fontSize: '9px', color: '#555555', letterSpacing: '1.5px' }}>EXAMPLE LISTING</span>
      </div>
    </div>
  );
}
