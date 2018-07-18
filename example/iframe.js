const getRow = (n) => {
    return `
    <tr>
    ${(Array.apply(null, Array(n))).map(() => '<td><iframe src="./example.html"></iframe></td>').join('\n')}
    </tr>
    `
}

const init = () => {
    let body = '<table>'
    for (let i = 0; i < 6; ++i) {
        body += getRow(4)
    }
    body += '</table>'
    document.body.innerHTML = body
}

document.addEventListener('DOMContentLoaded', init)
