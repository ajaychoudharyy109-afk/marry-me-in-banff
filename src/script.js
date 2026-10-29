  // Floating gallery: right-to-left drift + per-card cursor tilt
  (function(){
    var viewport = document.getElementById('floatViewport');
    if(!viewport) return;
    var cards = Array.prototype.slice.call(viewport.querySelectorAll('.fcard'));
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;

    // Cursor tilt — computed per-card in real time, so it stays correct
    // even while the track is continuously drifting underneath the cursor.
    if(!reduceMotion && !isCoarsePointer){
      viewport.addEventListener('mousemove', function(e){
        cards.forEach(function(card){
          var r = card.getBoundingClientRect();
          if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom){
            card.style.setProperty('--tiltX', '0deg');
            card.style.setProperty('--tiltY', '0deg');
            return;
          }
          var fx = (e.clientX - r.left) / r.width;
          var fy = (e.clientY - r.top) / r.height;
          card.style.setProperty('--tiltX', ((fy - 0.5) * -12).toFixed(2) + 'deg');
          card.style.setProperty('--tiltY', ((fx - 0.5) * 16).toFixed(2) + 'deg');
        });
      });
      viewport.addEventListener('mouseleave', function(){
        cards.forEach(function(card){
          card.style.setProperty('--tiltX', '0deg');
          card.style.setProperty('--tiltY', '0deg');
        });
      });
    }
  })();

  // Accordions (packages + FAQ)
  document.querySelectorAll('.pkg-row').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const pkg=btn.closest('.pkg'), body=pkg.querySelector('.pkg-body'), open=pkg.classList.toggle('open');
      btn.setAttribute('aria-expanded',open);
      body.style.maxHeight=open?body.scrollHeight+'px':0;
    });
  });
  document.querySelectorAll('.qa-q').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const qa=btn.closest('.qa'), a=qa.querySelector('.qa-a'), open=qa.classList.toggle('open');
      btn.setAttribute('aria-expanded',open);
      a.style.maxHeight=open?a.scrollHeight+'px':0;
    });
  });
  // Scroll reveal
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
  document.querySelectorAll('.reveal').forEach(el=>io.observe(el));
  // Close mobile nav on link tap
  document.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',()=>document.querySelector('header').classList.remove('nav-open')));
